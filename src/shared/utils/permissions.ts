import type { WebDavProfile } from '../models/backup'
import {
  WEBDAV_ERROR_MESSAGES,
  isInsecureHttp,
} from '../services/webdav-client'
import type { AppError, AsyncResult } from './result'
import { fail, ok } from './result'

/**
 * 可选主机权限申请（设计文档 4.5）。
 * 只请求用户填写的具体源，安装时不预置广域权限。
 * 必须在用户点击手势的调用链中触发。
 */
export function extractOrigin(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.origin
  } catch {
    return null
  }
}

export function isExtensionPermissionsAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.permissions?.contains === 'function' &&
    typeof chrome.permissions?.request === 'function'
  )
}

export async function ensureHostPermission(
  baseUrl: string,
): Promise<AsyncResult<true, AppError>> {
  // 普通开发预览页没有扩展权限体系，直接放行走页面 fetch。
  if (!isExtensionPermissionsAvailable()) {
    return ok(true)
  }

  const origin = extractOrigin(baseUrl)
  if (!origin) {
    return fail({ code: 'WEBDAV_URL_INVALID', message: WEBDAV_ERROR_MESSAGES.WEBDAV_URL_INVALID })
  }
  const origins = [`${origin}/*`]

  const alreadyGranted = await chrome.permissions.contains({ origins })
  if (alreadyGranted) {
    return ok(true)
  }

  let granted: boolean
  try {
    granted = await chrome.permissions.request({ origins })
  } catch (cause) {
    // 必须由用户手势触发；异步链路中被浏览器拒绝也归为未授权。
    return fail({
      code: 'WEBDAV_PERMISSION_NOT_GRANTED',
      message: WEBDAV_ERROR_MESSAGES.WEBDAV_PERMISSION_NOT_GRANTED,
      cause,
    })
  }
  return granted
    ? ok(true)
    : fail({
        code: 'WEBDAV_PERMISSION_NOT_GRANTED',
        message: WEBDAV_ERROR_MESSAGES.WEBDAV_PERMISSION_NOT_GRANTED,
      })
}

/** WebDAV 安全提示聚合：HTTP 明文传输（设计文档 4.5 末段）。 */
export function describeConnectionRisk(profile: Pick<WebDavProfile, 'baseUrl'>): string | null {
  if (isInsecureHttp(profile.baseUrl)) {
    return '当前为 HTTP 明文连接，可能在内网外暴露 WebDAV 凭据；公网地址请改用 HTTPS。'
  }
  return null
}
