import { afterEach, describe, expect, it, vi } from 'vitest'
import { WEBDAV_MESSAGE_TYPE } from '../shared/services/webdav-client'
import { registerWebDavHandler } from './webdav-handler'

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean

function installChromeStub(listenerRef: { current: MessageListener | null }) {
  const stub = {
    runtime: {
      onMessage: {
        addListener(listener: MessageListener) {
          listenerRef.current = listener
        },
      },
    },
  }
  // @ts-expect-error 仅安装测试所需的最小 chrome 形状
  globalThis.chrome = stub
}

afterEach(() => {
  // @ts-expect-error 清理测试桩
  delete globalThis.chrome
})

describe('registerWebDavHandler', () => {
  it('收到 WebDAV 消息时异步回传 fetch 结果，并保持消息通道', async () => {
    const listenerRef: { current: MessageListener | null } = { current: null }
    installChromeStub(listenerRef)
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    registerWebDavHandler(fetchMock as unknown as typeof fetch)

    const sendResponse = vi.fn()
    const keepOpen = listenerRef.current!(
      {
        type: WEBDAV_MESSAGE_TYPE,
        method: 'GET',
        url: 'http://192.168.1.20:5244/backup/a.json',
        headers: { Authorization: 'Basic x' },
      },
      {},
      sendResponse,
    )

    expect(keepOpen).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://192.168.1.20:5244/backup/a.json')
    expect(init.method).toBe('GET')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sendResponse).toHaveBeenCalledTimes(1)
    const result = sendResponse.mock.calls[0][0] as {
      ok: boolean
      data: { status: number; body: string }
    }
    expect(result.ok).toBe(true)
    expect(result.data.status).toBe(200)
    expect(result.data.body).toBe('{"ok":true}')
  })

  it('忽略非 WebDAV 消息且不保持通道', () => {
    const listenerRef: { current: MessageListener | null } = { current: null }
    installChromeStub(listenerRef)
    registerWebDavHandler(vi.fn() as unknown as typeof fetch)

    const keepOpen = listenerRef.current!({ type: 'something-else' }, {}, vi.fn())
    expect(keepOpen).toBe(false)
  })
})
