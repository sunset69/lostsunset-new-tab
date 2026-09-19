import type { KeyValueStorage } from './key-value-storage'
import { chromeStorage } from './chrome-storage'
import { localStorageStorage } from './local-storage'

function supportsChromeStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage === 'object' &&
    typeof chrome.storage?.local?.get === 'function'
  )
}

/**
 * 浏览器环境的默认存储：
 * - 扩展上下文使用 chrome.storage.local；
 * - 普通页面（开发预览）降级到 localStorage，行为保持一致。
 */
export const browserStorage: KeyValueStorage = supportsChromeStorage()
  ? chromeStorage
  : localStorageStorage
