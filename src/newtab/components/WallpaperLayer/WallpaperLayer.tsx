import { useEffect, useState } from 'react'
import { DEFAULT_WALLPAPER } from '../../../shared/config/builtin-wallpapers'
import type { WallpaperBackground } from '../../hooks/useWallpaper'
import './WallpaperLayer.css'

type WallpaperLayerProps = {
  background: WallpaperBackground | null
  /** 遮罩不透明度 0–1。 */
  overlayOpacity: number
}

/**
 * 壁纸层与可读性遮罩（设计文档 3.2 / 2.1.5）。
 * 图片加载失败时回退默认渐变；object-fit: cover 铺满全屏避免拉伸。
 * 整层为装饰内容，对辅助技术隐藏。
 */
export default function WallpaperLayer({ background, overlayOpacity }: WallpaperLayerProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [background])

  const showImage = background?.kind === 'image' && !imageFailed

  return (
    <div className="wallpaper-layer" aria-hidden="true">
      <div
        className="wallpaper-layer__gradient"
        style={{
          background:
            background?.kind === 'gradient' ? background.css : DEFAULT_WALLPAPER.value,
        }}
      />
      {showImage && (
        <img
          key={background.url}
          className="wallpaper-layer__image"
          src={background.url}
          alt=""
          onError={() => setImageFailed(true)}
        />
      )}
      <div
        className="wallpaper-layer__overlay"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      />
    </div>
  )
}
