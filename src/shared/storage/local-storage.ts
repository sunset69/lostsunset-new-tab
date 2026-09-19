import type { KeyValueStorage } from './key-value-storage'

/** 基于 localStorage 的 JSON 键值存储，用于无 chrome.storage 的开发预览页面。 */
export const localStorageStorage: KeyValueStorage = {
  async get<T>(key: string): Promise<T | undefined> {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  },

  async set(key: string, value: unknown): Promise<void> {
    window.localStorage.setItem(key, JSON.stringify(value))
  },

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(key)
  },
}
