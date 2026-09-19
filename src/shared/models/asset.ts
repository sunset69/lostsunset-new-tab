/** IndexedDB 中保存的壁纸二进制资产（设计文档 5.3）。 */
export type WallpaperAsset = {
  id: string
  blob: Blob
  mimeType: string
  /** 原始文件名，仅用于诊断与未来的资产管理 UI。 */
  name: string
  size: number
  createdAt: string
}
