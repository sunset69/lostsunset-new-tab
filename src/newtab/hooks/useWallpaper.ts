import { useEffect, useState } from 'react'
import { browserAssetStore } from '../../shared/storage/browser-asset-store'
import type { WallpaperConfig } from '../../shared/models/config'
import { resolveWallpaper } from '../../shared/services/wallpaper-service'

export type WallpaperBackground =
  | { kind: 'gradient'; css: string }
  | { kind: 'image'; url: string }

export type WallpaperState = {
  background: WallpaperBackground | null
  /** 上传资产在存储中缺失，已回退默认背景。 */
  recovered: boolean
}

/**
 * 按壁纸配置解析可渲染背景（设计文档 6.1 第 7 步）。
 * 上传资产转换为 object URL 并在变更/卸载时释放。
 * `rerollNonce` 变化时重新抽签（随机模式下「换一张」，0003 改善 4）；不落盘。
 */
export function useWallpaper(
  wallpaper: WallpaperConfig | null,
  rerollNonce = 0,
): WallpaperState {
  const [state, setState] = useState<WallpaperState>({ background: null, recovered: false })

  useEffect(() => {
    if (!wallpaper) {
      setState({ background: null, recovered: false })
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    void resolveWallpaper(wallpaper, browserAssetStore).then((resolved) => {
      if (cancelled) return
      const { descriptor, recovered } = resolved
      if (descriptor.kind === 'image' && descriptor.source === 'upload') {
        objectUrl = URL.createObjectURL(descriptor.blob)
        setState({ background: { kind: 'image', url: objectUrl }, recovered })
      } else if (descriptor.kind === 'image') {
        setState({ background: { kind: 'image', url: descriptor.url }, recovered })
      } else {
        setState({ background: { kind: 'gradient', css: descriptor.css }, recovered })
      }
    })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [wallpaper, rerollNonce])

  return state
}
