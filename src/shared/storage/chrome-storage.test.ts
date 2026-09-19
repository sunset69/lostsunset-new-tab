import { afterEach, describe, expect, it, vi } from 'vitest'
import { chromeStorage } from './chrome-storage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chromeStorage', () => {
  it('get 从 chrome.storage.local 的返回记录中按键取值', async () => {
    const get = vi.fn(async () => ({ 'userConfig.v1': { version: 1 } }))
    vi.stubGlobal('chrome', { storage: { local: { get } } })

    const value = await chromeStorage.get<{ version: number }>('userConfig.v1')
    expect(get).toHaveBeenCalledWith('userConfig.v1')
    expect(value).toEqual({ version: 1 })
  })

  it('键不存在时返回 undefined', async () => {
    vi.stubGlobal('chrome', {
      storage: { local: { get: vi.fn(async () => ({})) } },
    })
    expect(await chromeStorage.get('missing')).toBeUndefined()
  })

  it('set/remove 委托给 chrome.storage.local', async () => {
    const set = vi.fn(async () => undefined)
    const remove = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', { storage: { local: { set, remove } } })

    await chromeStorage.set('k', { a: 1 })
    expect(set).toHaveBeenCalledWith({ k: { a: 1 } })

    await chromeStorage.remove('k')
    expect(remove).toHaveBeenCalledWith('k')
  })
})
