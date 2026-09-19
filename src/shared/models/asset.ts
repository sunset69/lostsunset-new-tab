/** IndexedDB 中保存的壁纸二进制资产（设计文档 5.3）。 */
export type WallpaperAsset = {
  id: string
  blob: Blob
  mimeType: string
  /** 原始文件名，仅用于诊断与未来的资产管理 UI。 */
  name: string
  size: number
  createdAt: string
  /** 图片尺寸（裁剪入库时已知；旧资产可能缺失），用于缩略图布局。 */
  width?: number
  height?: number
}
