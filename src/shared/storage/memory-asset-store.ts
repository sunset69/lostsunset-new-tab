import type { WallpaperAsset } from '../models/asset'
import type { AssetStore } from './asset-store'

/** 进程内资产存储，作为测试用 fake IndexedDB。 */
export function createMemoryAssetStore(initial: Record<string, WallpaperAsset> = {}): AssetStore {
  const map = new Map<string, WallpaperAsset>(Object.entries(initial))

  return {
    async get(assetId) {
      return map.get(assetId)
    },
    async list() {
      return [...map.values()]
    },
    async put(asset) {
      map.set(asset.id, asset)
    },
    async remove(assetId) {
      map.delete(assetId)
    },
  }
}
