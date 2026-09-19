import type { WallpaperAsset } from '../models/asset'

/**
 * 壁纸二进制资产存储端口（设计文档 4.2 / 5.3）。
 * 生产环境由 IndexedDB 实现，单元测试使用内存实现（fake IndexedDB）。
 */
export interface AssetStore {
  get(assetId: string): Promise<WallpaperAsset | undefined>
  /** 全量资产列表（壁纸库 UI 使用）。 */
  list(): Promise<WallpaperAsset[]>
  put(asset: WallpaperAsset): Promise<void>
  remove(assetId: string): Promise<void>
}
