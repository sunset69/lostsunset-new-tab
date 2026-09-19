import type { WebDavProfile } from '../models/backup'
import type { AppError, AsyncResult } from '../utils/result'
import { fail, ok } from '../utils/result'

/**
 * WebDAV 客户端（设计文档 4.5 / 6.7 / 6.8）。
 * 不直接持有 fetch：传输层可注入浏览器 fetch（dev 直连）或
 * Service Worker 消息执行器（绕开页面 CORS），单元测试可注入 mock fetch。
 * 不保存任何状态或凭据副本，凭据仅随请求即时使用。
 */

/** Service Worker 消息类型，前端与后台共用，避免字符串漂移。 */
export const WEBDAV_MESSAGE_TYPE = 'lostsunset:webdav-request' as const

export const WEBDAV_ERROR_MESSAGES: Record<string, string> = {
  WEBDAV_PROFILE_INVALID: '请完整填写服务地址、远端路径、用户名和密码',
  WEBDAV_URL_INVALID: '仅支持 http 或 https 地址',
  WEBDAV_UNAUTHORIZED: '用户名或密码错误',
  WEBDAV_FORBIDDEN: '服务器拒绝访问，请检查账号权限',
  WEBDAV_REMOTE_NOT_FOUND: '远端备份文件不存在，请先上传',
  WEBDAV_HTTP_ERROR: 'WebDAV 服务器返回错误（HTTP {status}）',
  WEBDAV_NETWORK: '无法连接服务器，请检查地址和网络',
  WEBDAV_PERMISSION_NOT_GRANTED: '需要授权访问该服务器地址',
  WEBDAV_NO_RESPONSE: '后台服务没有响应，请重新打开扩展页面后重试',
}

export function webdavErrorMessage(error: AppError): string {
  const template = WEBDAV_ERROR_MESSAGES[error.code] ?? error.message
  const status =
    error.cause && typeof error.cause === 'object' && 'status' in error.cause
      ? String((error.cause as { status: unknown }).status)
      : undefined
  return status
    ? template.replace('{status}', status)
    : template.replace('（HTTP {status}）', '')
}

export type WebDavMethod = 'GET' | 'PUT' | 'HEAD'

export type WebDavRequest = {
  method: WebDavMethod
  url: string
  headers: Record<string, string>
  body?: string
}

export type WebDavResponse = {
  status: number
  /** HEAD 响应的 Last-Modified，用于覆盖风险提示。 */
  lastModified: string | null
  body: string
}

export type WebDavExecutor = (
  request: WebDavRequest,
) => Promise<AsyncResult<WebDavResponse, AppError>>

function webdavError(code: string, status?: number, cause?: unknown): AppError {
  return {
    code,
    message: WEBDAV_ERROR_MESSAGES[code] ?? 'WebDAV 请求失败',
    cause: status !== undefined ? { status, ...(cause as object) } : cause,
  }
}

/** 拼接根地址与远端文件路径；拒绝非 http(s) 协议（设计文档 7：URL 协议不合法）。 */
export function joinWebDavUrl(baseUrl: string, remotePath: string): AsyncResult<string> {
  try {
    const base = baseUrl.trim()
    const path = remotePath.trim()
    if (!base || !path) {
      return fail(webdavError('WEBDAV_PROFILE_INVALID'))
    }
    const parsedBase = new URL(base)
    if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
      return fail(webdavError('WEBDAV_URL_INVALID'))
    }
    // base 统一视为目录；remotePath 以 / 开头时是服务器绝对路径，
    // 否则相对 base 目录解析（保留 base 中已有的 /dav 等路径段）。
    const normalizedBase = base.replace(/\/+$/, '') + '/'
    return ok(new URL(path, normalizedBase).toString())
  } catch {
    return fail(webdavError('WEBDAV_URL_INVALID'))
  }
}

/** 内网 HTTP 风险提示判断（设计文档 4.5）。 */
export function isInsecureHttp(baseUrl: string): boolean {
  try {
    return new URL(baseUrl.trim()).protocol === 'http:'
  } catch {
    return false
  }
}

/** 校验并规范化表单中的 WebDAV 配置。 */
export function validateWebDavProfile(
  input: Partial<Record<keyof WebDavProfile, unknown>>,
): AsyncResult<WebDavProfile> {
  const baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : ''
  const remotePath = typeof input.remotePath === 'string' ? input.remotePath.trim() : ''
  const username = typeof input.username === 'string' ? input.username.trim() : ''
  const credential = typeof input.credential === 'string' ? input.credential : ''
  const rememberCredential = input.rememberCredential === true

  if (!baseUrl || !remotePath || !username || !credential) {
    return fail(webdavError('WEBDAV_PROFILE_INVALID'))
  }

  const url = joinWebDavUrl(baseUrl, remotePath)
  if (!url.ok) {
    return fail(url.error)
  }

  return ok({ baseUrl, remotePath, username, credential, rememberCredential })
}

/** UTF-8 安全的 Basic 认证头。 */
export function basicAuthHeader(username: string, credential: string): string {
  const bytes = new TextEncoder().encode(`${username}:${credential}`)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return `Basic ${btoa(binary)}`
}

function mapHttpStatus(status: number): AppError | null {
  if (status === 401) {
    return webdavError('WEBDAV_UNAUTHORIZED', status)
  }
  if (status === 403) {
    return webdavError('WEBDAV_FORBIDDEN', status)
  }
  if (status < 200 || status >= 300) {
    return webdavError('WEBDAV_HTTP_ERROR', status)
  }
  return null
}

/** 基于全局 fetch 的执行器，供 Service Worker 与 dev 预览直连使用。 */
export function createFetchExecutor(fetchImpl: typeof fetch): WebDavExecutor {
  return async (request) => {
    let response: Response
    try {
      response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
    } catch (cause) {
      return fail(webdavError('WEBDAV_NETWORK', undefined, cause))
    }
    const body = request.method === 'HEAD' ? '' : await response.text()
    return ok({
      status: response.status,
      lastModified: response.headers.get('last-modified'),
      body,
    })
  }
}

export type WebDavHeadResult = {
  exists: boolean
  lastModified: string | null
}

export function createWebDavClient(executor: WebDavExecutor) {
  async function requestFile(
    profile: WebDavProfile,
    method: WebDavMethod,
    body?: string,
  ): Promise<AsyncResult<WebDavResponse, AppError>> {
    const urlResult = joinWebDavUrl(profile.baseUrl, profile.remotePath)
    if (!urlResult.ok) {
      return fail(urlResult.error)
    }
    const headers: Record<string, string> = {
      Authorization: basicAuthHeader(profile.username, profile.credential),
    }
    if (method === 'PUT') {
      headers['Content-Type'] = 'application/json;charset=utf-8'
    }
    return executor({ method, url: urlResult.data, headers, body })
  }

  async function requestBase(
    profile: WebDavProfile,
    method: WebDavMethod,
  ): Promise<AsyncResult<WebDavResponse, AppError>> {
    let parsed: string
    try {
      const parsedBase = new URL(profile.baseUrl.trim())
      if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
        return fail(webdavError('WEBDAV_URL_INVALID'))
      }
      parsed = parsedBase.toString()
    } catch {
      return fail(webdavError('WEBDAV_URL_INVALID'))
    }
    return executor({
      method,
      url: parsed,
      headers: { Authorization: basicAuthHeader(profile.username, profile.credential) },
    })
  }

  return {
    /** 探测服务可达性与凭据：收到任何 HTTP 响应（除 401/403）都视为连接正常。 */
    async testConnection(profile: WebDavProfile): Promise<AsyncResult<true, AppError>> {
      const result = await requestBase(profile, 'HEAD')
      if (!result.ok) {
        return fail(result.error)
      }
      if (result.data.status === 401) {
        return fail(webdavError('WEBDAV_UNAUTHORIZED', 401))
      }
      if (result.data.status === 403) {
        return fail(webdavError('WEBDAV_FORBIDDEN', 403))
      }
      return ok(true)
    },

    /** 查询远端备份是否存在及其修改时间（404 视为不存在，不是错误）。 */
    async headBackup(profile: WebDavProfile): Promise<AsyncResult<WebDavHeadResult, AppError>> {
      const result = await requestFile(profile, 'HEAD')
      if (!result.ok) {
        return fail(result.error)
      }
      if (result.data.status === 404) {
        return ok({ exists: false, lastModified: null })
      }
      const statusError = mapHttpStatus(result.data.status)
      if (statusError) {
        return fail(statusError)
      }
      return ok({ exists: true, lastModified: result.data.lastModified })
    },

    /** 下载远端备份文本。 */
    async getBackupText(profile: WebDavProfile): Promise<AsyncResult<string, AppError>> {
      const result = await requestFile(profile, 'GET')
      if (!result.ok) {
        return fail(result.error)
      }
      if (result.data.status === 404) {
        return fail(webdavError('WEBDAV_REMOTE_NOT_FOUND', 404))
      }
      const statusError = mapHttpStatus(result.data.status)
      if (statusError) {
        return fail(statusError)
      }
      return ok(result.data.body)
    },

    /** 上传备份文本，接受 200/201/204。 */
    async putBackupText(
      profile: WebDavProfile,
      content: string,
    ): Promise<AsyncResult<true, AppError>> {
      const result = await requestFile(profile, 'PUT', content)
      if (!result.ok) {
        return fail(result.error)
      }
      const statusError = mapHttpStatus(result.data.status)
      if (statusError) {
        return fail(statusError)
      }
      return ok(true)
    },
  }
}

export type WebDavClient = ReturnType<typeof createWebDavClient>
