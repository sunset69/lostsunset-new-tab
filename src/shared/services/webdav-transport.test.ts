import { afterEach, describe, expect, it, vi } from 'vitest'
import { ok } from '../utils/result'
import { WEBDAV_MESSAGE_TYPE, type WebDavRequest } from './webdav-client'
import { createBrowserExecutor, isExtensionContext } from './webdav-transport'

const request: WebDavRequest = {
  method: 'HEAD',
  url: 'http://127.0.0.1:8899/dav/',
  headers: { Authorization: 'Basic dGVzdDp0ZXN0' },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isExtensionContext', () => {
  it('无 chrome.runtime.sendMessage 时视为普通页面', () => {
    expect(isExtensionContext()).toBe(false)
  })

  it('具备 runtime.id 与 sendMessage 时视为扩展上下文', () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id', sendMessage: vi.fn() },
    })
    expect(isExtensionContext()).toBe(true)
  })
})

describe('createBrowserExecutor 普通页面直连', () => {
  it('直接调用页面 fetch 执行请求', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200, headers: new Headers() }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createBrowserExecutor()(request)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(request.url)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.status).toBe(200)
  })
})

describe('createBrowserExecutor 扩展消息通道', () => {
  it('经 chrome.runtime.sendMessage 转发并透传类型标记', async () => {
    const reply = ok({ status: 200, lastModified: null, body: '' })
    const sendMessage = vi.fn(async () => reply)
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id', sendMessage },
    })

    const result = await createBrowserExecutor()(request)
    expect(sendMessage).toHaveBeenCalledWith({ type: WEBDAV_MESSAGE_TYPE, ...request })
    expect(result).toEqual(reply)
  })

  it('sendMessage 抛错时返回无响应错误', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'ext-id',
        sendMessage: vi.fn(async () => {
          throw new Error('channel closed')
        }),
      },
    })

    const result = await createBrowserExecutor()(request)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_NO_RESPONSE')
  })

  it('消息无返回内容时返回无响应错误', async () => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-id', sendMessage: vi.fn(async () => undefined) },
    })

    const result = await createBrowserExecutor()(request)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_NO_RESPONSE')
  })
})
