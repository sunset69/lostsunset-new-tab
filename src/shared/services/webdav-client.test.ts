import { describe, expect, it, vi } from 'vitest'
import {
  basicAuthHeader,
  createFetchExecutor,
  createWebDavClient,
  isInsecureHttp,
  joinWebDavUrl,
  validateWebDavProfile,
} from './webdav-client'
import type { WebDavProfile } from '../models/backup'
import { parseBackupText } from './backup-service'

const profile: WebDavProfile = {
  baseUrl: 'http://192.168.1.20:5244',
  remotePath: '/backup/lostsunset.json',
  username: 'alice',
  credential: 'secret',
  rememberCredential: true,
}

describe('joinWebDavUrl', () => {
  it('正确拼接根地址与远端路径', () => {
    const r1 = joinWebDavUrl('http://192.168.1.20:5244', '/backup/a.json')
    expect(r1.ok && r1.data).toBe('http://192.168.1.20:5244/backup/a.json')

    const r2 = joinWebDavUrl('http://192.168.1.20:5244/', 'backup/a.json')
    expect(r2.ok && r2.data).toBe('http://192.168.1.20:5244/backup/a.json')

    const r3 = joinWebDavUrl('  https://dav.example.com/dav/  ', '  a/b.json  ')
    expect(r3.ok && r3.data).toBe('https://dav.example.com/dav/a/b.json')
  })

  it('拒绝空地址或空路径', () => {
    expect(joinWebDavUrl('', '/a.json').ok).toBe(false)
    expect(joinWebDavUrl('http://x.com', '').ok).toBe(false)
  })

  it('拒绝非 http(s) 协议', () => {
    const result = joinWebDavUrl('ftp://192.168.1.20', '/a.json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_URL_INVALID')
  })

  it('拒绝无法解析的地址', () => {
    expect(joinWebDavUrl('not a url', '/a.json').ok).toBe(false)
  })
})

describe('isInsecureHttp', () => {
  it('仅对 http:// 地址返回 true', () => {
    expect(isInsecureHttp('http://10.0.0.1')).toBe(true)
    expect(isInsecureHttp('https://dav.x.com')).toBe(false)
    expect(isInsecureHttp('garbage')).toBe(false)
  })
})

describe('validateWebDavProfile', () => {
  it('合法配置被裁剪规范化', () => {
    const result = validateWebDavProfile({
      baseUrl: '  http://host:5244/ ',
      remotePath: ' b.json ',
      username: ' bob ',
      credential: 'pw',
      rememberCredential: false,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.baseUrl).toBe('http://host:5244/')
      expect(result.data.remotePath).toBe('b.json')
      expect(result.data.username).toBe('bob')
      expect(result.data.rememberCredential).toBe(false)
    }
  })

  it('缺少密码时拒绝', () => {
    const result = validateWebDavProfile({ ...profile, credential: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_PROFILE_INVALID')
  })

  it('非法协议时拒绝', () => {
    const result = validateWebDavProfile({ ...profile, baseUrl: 'ftp://host' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_URL_INVALID')
  })
})

describe('basicAuthHeader', () => {
  it('生成标准 Basic 头', () => {
    expect(basicAuthHeader('user', 'pass')).toBe(`Basic ${btoa('user:pass')}`)
  })
})

function mockResponse(status: number, body?: string, headers: Record<string, string> = {}) {
  return new Response(body ?? null, {
    status,
    headers: new Headers(headers),
  })
}

function setupClient(fetchMock: ReturnType<typeof vi.fn>) {
  return createWebDavClient(createFetchExecutor(fetchMock as unknown as typeof fetch))
}

describe('WebDavClient 上传', () => {
  it('PUT 201 视为成功并携带认证头与 JSON 内容', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(201))
    const client = setupClient(fetchMock)
    const result = await client.putBackupText(profile, '{"kind":1}')

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://192.168.1.20:5244/backup/lostsunset.json')
    expect(init.method).toBe('PUT')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${btoa('alice:secret')}`)
    expect(headers['Content-Type']).toContain('application/json')
    expect(init.body).toBe('{"kind":1}')
  })

  it('PUT 204 同样成功', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(204))
    const client = setupClient(fetchMock)
    expect((await client.putBackupText(profile, '{}')).ok).toBe(true)
  })

  it('401/403/500 分别映射错误码', async () => {
    const c401 = setupClient(vi.fn().mockResolvedValue(mockResponse(401)))
    const r401 = await c401.putBackupText(profile, '{}')
    expect(r401.ok).toBe(false)
    if (!r401.ok) {
      expect(r401.error.code).toBe('WEBDAV_UNAUTHORIZED')
      expect((r401.error.cause as { status: number }).status).toBe(401)
    }

    const c403 = setupClient(vi.fn().mockResolvedValue(mockResponse(403)))
    const r403 = await c403.putBackupText(profile, '{}')
    expect(!r403.ok && r403.error.code).toBe('WEBDAV_FORBIDDEN')

    const c500 = setupClient(vi.fn().mockResolvedValue(mockResponse(500)))
    const r500 = await c500.putBackupText(profile, '{}')
    expect(!r500.ok && r500.error.code).toBe('WEBDAV_HTTP_ERROR')
  })

  it('网络异常映射为 WEBDAV_NETWORK', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = setupClient(fetchMock)
    const result = await client.putBackupText(profile, '{}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WEBDAV_NETWORK')
  })
})

describe('WebDavClient 下载与探测', () => {
  it('GET 200 返回正文；404 提示远端文件不存在', async () => {
    const ok200 = setupClient(vi.fn().mockResolvedValue(mockResponse(200, 'hello-body')))
    const r1 = await ok200.getBackupText(profile)
    expect(r1.ok && r1.data).toBe('hello-body')

    const notFound = setupClient(vi.fn().mockResolvedValue(mockResponse(404)))
    const r2 = await notFound.getBackupText(profile)
    expect(!r2.ok && r2.error.code).toBe('WEBDAV_REMOTE_NOT_FOUND')
  })

  it('HEAD 200 返回存在与 Last-Modified', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse(200, '', { 'Last-Modified': 'Sat, 19 Sep 2026 03:00:00 GMT' }))
    const client = setupClient(fetchMock)
    const result = await client.headBackup(profile)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.exists).toBe(true)
      expect(result.data.lastModified).toContain('2026')
    }
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('HEAD')
  })

  it('HEAD 404 视为文件不存在而非错误', async () => {
    const client = setupClient(vi.fn().mockResolvedValue(mockResponse(404)))
    const result = await client.headBackup(profile)
    expect(result.ok && result.data).toEqual({ exists: false, lastModified: null })
  })

  it('testConnection 对根地址发 HEAD，404 视为可达，401 视为凭据错误', async () => {
    const reachableFetch = vi.fn().mockResolvedValue(mockResponse(404))
    const reachable = setupClient(reachableFetch)
    const r1 = await reachable.testConnection(profile)
    expect(r1.ok).toBe(true)
    expect(reachableFetch.mock.calls[0][0]).toBe('http://192.168.1.20:5244/')

    const unauthorized = setupClient(vi.fn().mockResolvedValue(mockResponse(401)))
    const r2 = await unauthorized.testConnection(profile)
    expect(!r2.ok && r2.error.code).toBe('WEBDAV_UNAUTHORIZED')
  })

  it('下载到非 JSON 内容时由备份校验拒绝', async () => {
    const client = setupClient(vi.fn().mockResolvedValue(mockResponse(200, '<html>oops</html>')))
    const text = await client.getBackupText(profile)
    expect(text.ok).toBe(true)
    if (text.ok) {
      const parsed = parseBackupText(text.data)
      expect(!parsed.ok && parsed.error.code).toBe('BACKUP_INVALID')
    }
  })
})
