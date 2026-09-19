import { useRef, useState } from 'react'
import { useConfig } from '../../config/config-context'
import { browserAssetStore } from '../../../shared/storage/browser-asset-store'
import {
  BUILTIN_IMAGE_PRESETS,
  GRADIENT_PRESETS,
} from '../../../shared/config/builtin-wallpapers'
import {
  WALLPAPER_ERROR_MESSAGES,
  applyPresetWallpaper,
  saveUploadedWallpaper,
  validateImageFile,
} from '../../../shared/services/wallpaper-service'

/** 壁纸设置（设计文档 2.1.5 / 6.4）：渐变、内置图、上传与遮罩调节。 */
export default function WallpaperSection() {
  const { config, updateConfig, commitConfig } = useConfig()
  const wallpaper = config!.settings.wallpaper
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function isGradientActive(value: string): boolean {
    return wallpaper.mode === 'gradient' && wallpaper.value === value
  }

  async function choosePreset(
    preset: { mode: 'gradient'; value: string } | { mode: 'builtin'; value: string },
  ) {
    setError(null)
    const next = await applyPresetWallpaper(config!, preset, browserAssetStore)
    await commitConfig(next)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const checked = validateImageFile(file)
    if (!checked.ok) {
      setError(
        WALLPAPER_ERROR_MESSAGES[
          checked.error.code as keyof typeof WALLPAPER_ERROR_MESSAGES
        ] ?? checked.error.message,
      )
      return
    }

    setError(null)
    setUploading(true)
    try {
      const result = await saveUploadedWallpaper(config!, file, browserAssetStore)
      if (result.ok) {
        await commitConfig(result.data)
      } else {
        setError(result.error.message)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="wallpaper-settings">
      <span className="field__label">渐变背景</span>
      <div className="wallpaper-grid" role="radiogroup" aria-label="渐变背景">
        {GRADIENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isGradientActive(preset.value)}
            className={`wallpaper-swatch${isGradientActive(preset.value) ? ' wallpaper-swatch--active' : ''}`}
            style={{ background: preset.value }}
            title={preset.name}
            onClick={() => choosePreset({ mode: 'gradient', value: preset.value })}
          >
            <span className="visually-hidden">{preset.name}</span>
          </button>
        ))}
      </div>

      <span className="field__label">内置壁纸</span>
      <div className="wallpaper-grid" role="radiogroup" aria-label="内置壁纸">
        {BUILTIN_IMAGE_PRESETS.map((preset) => {
          const active = wallpaper.mode === 'builtin' && wallpaper.value === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`wallpaper-swatch wallpaper-swatch--image${active ? ' wallpaper-swatch--active' : ''}`}
              title={preset.name}
              onClick={() => choosePreset({ mode: 'builtin', value: preset.id })}
            >
              <img src={preset.url} alt="" />
              <span className="wallpaper-swatch__name">{preset.name}</span>
            </button>
          )
        })}
      </div>

      <div className="field">
        <span className="field__label">本地上传</span>
        <input
          ref={fileInputRef}
          id="wallpaper-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          onChange={handleFileChange}
        />
        <div className="wallpaper-upload">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? '正在保存…' : '选择图片上传'}
          </button>
          <span className="field__help">
            {wallpaper.mode === 'upload'
              ? '当前使用已上传的本地壁纸'
              : '支持 PNG / JPEG / WebP，最大 10 MB，保存在本机浏览器中'}
          </span>
        </div>
        {error && <p className="field__error">{error}</p>}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="wallpaper-overlay">
          遮罩深度（保证文字可读）：{Math.round(wallpaper.overlayOpacity * 100)}%
        </label>
        <input
          id="wallpaper-overlay"
          type="range"
          min={0}
          max={0.8}
          step={0.02}
          value={wallpaper.overlayOpacity}
          className="wallpaper-range"
          onChange={(event) =>
            updateConfig((draft) => {
              const value = Number(event.target.value)
              draft.settings.wallpaper.overlayOpacity = Number.isFinite(value)
                ? Math.min(0.8, Math.max(0, value))
                : 0.28
            })
          }
        />
      </div>
    </div>
  )
}
