import {
  createFetchExecutor,
  WEBDAV_MESSAGE_TYPE,
  type WebDavRequest,
} from '../shared/services/webdav-client'

/**
 * Service Worker 侧 WebDAV 请求处理（设计文档 4.5 第 5-6 步）。
 * 无状态：不保存任何连接信息，只把扩展页面的请求转换为带主机权限的 fetch，
 * 并返回统一结果形态。返回 true 保持消息通道以等待异步响应。
 */
type IncomingMessage = {
  type?: unknown
  method?: unknown
  url?: unknown
  headers?: unknown
  body?: unknown
}

function isWebDavMessage(message: IncomingMessage): message is {
  type: typeof WEBDAV_MESSAGE_TYPE
} & WebDavRequest {
  return (
    message.type === WEBDAV_MESSAGE_TYPE &&
    (message.method === 'GET' || message.method === 'PUT' || message.method === 'HEAD') &&
    typeof message.url === 'string' &&
    (message.headers === undefined ||
      (typeof message.headers === 'object' && message.headers !== null))
  )
}

export function registerWebDavHandler(fetchImpl: typeof fetch = globalThis.fetch): void {
  const executor = createFetchExecutor(fetchImpl)
  chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    const message = rawMessage as IncomingMessage
    if (!isWebDavMessage(message)) {
      return false
    }
    const request: WebDavRequest = {
      method: message.method,
      url: message.url,
      headers: (message.headers as Record<string, string>) ?? {},
      body: message.body as string | undefined,
    }
    void executor(request).then(sendResponse)
    return true
  })
}
