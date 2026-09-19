import type { AssetStore } from './asset-store'
import { createMemoryAssetStore } from './memory-asset-store'
import { indexedDbAssetStore } from './indexeddb-asset-store'

/**
 * 浏览器环境的壁纸资产存储：
 * - 支持 IndexedDB 时使用 IndexedDB；
 * - 普通页面预览等无 IndexedDB 环境下降级到内存存储（刷新后丢失，仅用于预览）。
 */
export const browserAssetStore: AssetStore =
  typeof indexedDB !== 'undefined' ? indexedDbAssetStore : createMemoryAssetStore()
