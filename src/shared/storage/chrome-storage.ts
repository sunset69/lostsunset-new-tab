import type { KeyValueStorage } from './key-value-storage'

/** 基于 chrome.storage.local 的键值存储实现。 */
export const chromeStorage: KeyValueStorage = {
  async get<T>(key: string): Promise<T | undefined> {
    const record = await chrome.storage.local.get(key)
    return record[key] as T | undefined
  },

  async set(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
}
