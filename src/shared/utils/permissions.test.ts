import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  describeConnectionRisk,
  ensureHostPermission,
  extractOrigin,
  isExtensionPermissionsAvailable,
} from './permissions'

function stubChromePermissions(impl: {
  contains?: boolean
  request?: boolean | Promise<boolean>
  requestThrows?: boolean
}) {
  vi.stubGlobal('chrome', {
    permissions: {
      contains: vi.fn(async () => impl.contains ?? false),
      request: vi.fn(async () => {
        if (impl.requestThrows) throw new Error('not in user gesture')
        return impl.request ?? false
      }),
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('extractOrigin', () => {
  it('提取 http/https 源并裁剪空白', () => {
    expect(extractOrigin('  https://dav.example.com/dav/ ')).toBe('https://dav.example.com')
    expect(extractOrigin('http://127.0.0.1:8899/dav/')).toBe('http://127.0.0.1:8899')
  })

  it('非 http(s) 或非法地址返回 null', () => {
    expect(extractOrigin('javascript:alert(1)')).toBeNull()
    expect(extractOrigin('not a url')).toBeNull()
  })
})

describe('isExtensionPermissionsAvailable', () => {
  it('无 chrome.permissions 时不可用', () => {
    expect(isExtensionPermissionsAvailable()).toBe(false)
  })
})

describe('ensureHostPermission', () => {
  it('普通开发预览页直接放行且不申请权限', async () => {
    const result = await ensureHostPermission('http://127.0.0.1:8899/dav/')
    expect(result.ok).toBe(true)
  })

  it('已授权时不再弹窗请求', async () => {
    stubChromePermissions({ contains: true })
    const result = await ensureHostPermission('http://127.0.0.1:8899/dav/')
    expect(result.ok).toBe(true)
    expect(chrome.permissions.request).not.toHaveBeenCalled()
  })

  it('未授权但用户同意时返回成功，申请范围为具体源', async () => {
    stubChromePermissions({ contains: false, request: true })
    const result = await ensureHostPermission('http://127.0.0.1:8899/dav/')
    expect(result.ok).toBe(true)
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ['http://127.0.0.1:8899/*'],
    })
  })

  it('用户拒绝授权时返回未授权错误', async () => {
    stubChromePermissions({ contains: false, request: false })
    const result = await ensureHostPermission('http://127.0.0.1:8899/dav/')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_PERMISSION_NOT_GRANTED')
  })

  it('申请抛错（如非用户手势）时返回未授权错误', async () => {
    stubChromePermissions({ contains: false, requestThrows: true })
    const result = await ensureHostPermission('http://127.0.0.1:8899/dav/')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_PERMISSION_NOT_GRANTED')
  })

  it('扩展上下文中的非法地址返回地址错误', async () => {
    stubChromePermissions({ contains: false, request: true })
    const result = await ensureHostPermission('garbage')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_URL_INVALID')
  })
})

describe('describeConnectionRisk', () => {
  it('HTTP 地址给出明文风险提示，HTTPS 不提示', () => {
    expect(describeConnectionRisk({ baseUrl: 'http://10.0.0.1/dav' })).toBeTypeOf('string')
    expect(describeConnectionRisk({ baseUrl: 'https://dav.example.com' })).toBeNull()
  })
})
