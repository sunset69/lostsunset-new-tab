import type { AppError, AsyncResult } from '../utils/result'
import { fail } from '../utils/result'
import {
  WEBDAV_ERROR_MESSAGES,
  WEBDAV_MESSAGE_TYPE,
  createFetchExecutor,
  type WebDavExecutor,
  type WebDavRequest,
  type WebDavResponse,
} from './webdav-client'

/**
 * WebDAV 请求传输选择（设计文档 4.5 第 5 步）：
 * - 扩展上下文：经 chrome.runtime.sendMessage 交给 Service Worker 执行，
 *   借助主机权限绕开页面 CORS；
 * - 普通页面（开发预览）：直接用页面 fetch，依赖目标服务的 CORS 策略。
 */
export function isExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime?.id === 'string' &&
    typeof chrome.runtime?.sendMessage === 'function'
  )
}

function noResponse(): AsyncResult<never, AppError> {
  return fail({
    code: 'WEBDAV_NO_RESPONSE',
    message: WEBDAV_ERROR_MESSAGES.WEBDAV_NO_RESPONSE,
  })
}

export function createBrowserExecutor(): WebDavExecutor {
  if (isExtensionContext()) {
    return async (
      request: WebDavRequest,
    ): Promise<AsyncResult<WebDavResponse, AppError>> => {
      let reply: AsyncResult<WebDavResponse, AppError> | undefined
      try {
        reply = await chrome.runtime.sendMessage({ type: WEBDAV_MESSAGE_TYPE, ...request })
      } catch (cause) {
        return fail({
          code: 'WEBDAV_NO_RESPONSE',
          message: WEBDAV_ERROR_MESSAGES.WEBDAV_NO_RESPONSE,
          cause,
        })
      }
      return reply ?? noResponse()
    }
  }
  return createFetchExecutor(globalThis.fetch)
}
