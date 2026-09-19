import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../config/config-context'
import { browserAssetStore } from '../../../shared/storage/browser-asset-store'
import {
  BUILTIN_IMAGE_PRESETS,
  GRADIENT_PRESETS,
} from '../../../shared/config/builtin-wallpapers'
import type { WallpaperAsset } from '../../../shared/models/asset'
import type { WallpaperRandomPool } from '../../../shared/models/config'
import {
  WALLPAPER_ERROR_MESSAGES,
  addWallpaperAsset,
  applyPresetWallpaper,
  removeWallpaperAsset,
  validateImageFile,
} from '../../../shared/services/wallpaper-service'
import WallpaperCropDialog from '../WallpaperCropDialog/WallpaperCropDialog'

/** 壁纸设置（0001 改善 1/2/3）：随机、渐变、内置图、上传裁剪与壁纸库。 */
export default function WallpaperSection() {
  const { config, updateConfig, commitConfig } = useConfig()
  const wallpaper = config!.settings.wallpaper
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [libraryAssets, setLibraryAssets] = useState<WallpaperAsset[]>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})

  const pool: WallpaperRandomPool = wallpaper.randomPool ?? {
    gradients: [],
    builtinIds: [],
    assetIds: [],
  }

  const loadLibrary = useCallback(async () => {
    const assets = await browserAssetStore.list()
    setLibraryAssets(assets)
  }, [])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  // 缩略图 objectURL 生命周期管理。
  useEffect(() => {
    const urls: Record<string, string> = {}
    for (const asset of libraryAssets) {
      urls[asset.id] = URL.createObjectURL(asset.blob)
    }
    setThumbnailUrls(urls)
    return () => {
      for (const url of Object.values(urls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [libraryAssets])

  function togglePoolValue(key: keyof WallpaperRandomPool, value: string) {
    const current = pool[key]
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    updateConfig((draft) => {
      draft.settings.wallpaper.randomPool = {
        gradients: draft.settings.wallpaper.randomPool?.gradients ?? [],
        builtinIds: draft.settings.wallpaper.randomPool?.builtinIds ?? [],
        assetIds: draft.settings.wallpaper.randomPool?.assetIds ?? [],
        [key]: next,
      }
    })
  }

  function isGradientActive(value: string): boolean {
    return wallpaper.mode === 'gradient' && wallpaper.value === value
  }

  async function choosePreset(
    preset: { mode: 'gradient'; value: string } | { mode: 'builtin'; value: string },
  ) {
    setError(null)
    const next = await applyPresetWallpaper(config!, preset)
    await commitConfig(next)
  }

  function chooseRandomMode() {
    setError(null)
    void updateConfig((draft) => {
      draft.settings.wallpaper.mode = 'random'
      draft.settings.wallpaper.value = ''
      delete draft.settings.wallpaper.assetId
    })
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
    // 校验通过后进入裁剪；入库在裁剪确认后进行。
    setPendingCrop(file)
  }

  async function handleCropConfirm(input: {
    blob: Blob
    mimeType: string
    name: string
    width?: number
    height?: number
  }) {
    setPendingCrop(null)
    const result = await addWallpaperAsset(config!, input, browserAssetStore)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    await commitConfig(result.data)
    await loadLibrary()
  }

  function applyAsset(assetId: string) {
    setError(null)
    void updateConfig((draft) => {
      draft.settings.wallpaper = {
        mode: 'upload',
        value: assetId,
        assetId: assetId,
        overlayOpacity: draft.settings.wallpaper.overlayOpacity,
        randomPool: draft.settings.wallpaper.randomPool,
      }
    })
  }

  async function deleteAsset(asset: WallpaperAsset) {
    const activeId =
      wallpaper.mode === 'upload' ? (wallpaper.assetId ?? wallpaper.value) : null
    if (activeId === asset.id) {
      const confirmed = window.confirm('这是当前正在使用的壁纸，删除后将回退默认渐变。确定删除？')
      if (!confirmed) return
    }
    setError(null)
    const next = await removeWallpaperAsset(config!, asset.id, browserAssetStore)
    await commitConfig(next)
    await loadLibrary()
  }

  const activeUploadAssetId =
    wallpaper.mode === 'upload' ? (wallpaper.assetId ?? wallpaper.value) : null

  return (
    <div className="wallpaper-settings">
      <span className="field__label">随机壁纸</span>
      <div className="wallpaper-grid" role="radiogroup" aria-label="随机壁纸">
        <button
          type="button"
          role="radio"
          aria-checked={wallpaper.mode === 'random'}
          className={`wallpaper-random${wallpaper.mode === 'random' ? ' wallpaper-random--active' : ''}`}
          onClick={chooseRandomMode}
        >
          <span className="wallpaper-random__icon" aria-hidden="true">
            🎲
          </span>
          <span>
            每次打开新标签页
            <br />
            随机显示一张
          </span>
        </button>
      </div>
      <p className="field__help">
        用缩略图上的勾选框选择参与随机的壁纸（当前随机池：渐变 {pool.gradients.length}、内置图{' '}
        {pool.builtinIds.length}、本地 {pool.assetIds.length} 张）。
      </p>

      <span className="field__label">渐变背景</span>
      <div className="wallpaper-grid" role="radiogroup" aria-label="渐变背景">
        {GRADIENT_PRESETS.map((preset) => (
          <div
            key={preset.id}
            className={`wallpaper-cell${isGradientActive(preset.value) ? ' wallpaper-cell--active' : ''}`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isGradientActive(preset.value)}
              className="wallpaper-swatch"
              style={{ background: preset.value }}
              title={preset.name}
              onClick={() => choosePreset({ mode: 'gradient', value: preset.value })}
            >
              <span className="visually-hidden">{preset.name}</span>
            </button>
            <label className="wallpaper-cell__check">
              <input
                type="checkbox"
                checked={pool.gradients.includes(preset.value)}
                onChange={() => togglePoolValue('gradients', preset.value)}
                aria-label={`随机池包含${preset.name}`}
              />
            </label>
          </div>
        ))}
      </div>

      <span className="field__label">内置壁纸</span>
      <div className="wallpaper-grid" role="radiogroup" aria-label="内置壁纸">
        {BUILTIN_IMAGE_PRESETS.map((preset) => {
          const active = wallpaper.mode === 'builtin' && wallpaper.value === preset.id
          return (
            <div
              key={preset.id}
              className={`wallpaper-cell wallpaper-cell--image${active ? ' wallpaper-cell--active' : ''}`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={active}
                className="wallpaper-swatch wallpaper-swatch--image"
                title={preset.name}
                onClick={() => choosePreset({ mode: 'builtin', value: preset.id })}
              >
                <img src={preset.url} alt="" />
                <span className="wallpaper-swatch__name">{preset.name}</span>
              </button>
              <label className="wallpaper-cell__check">
                <input
                  type="checkbox"
                  checked={pool.builtinIds.includes(preset.id)}
                  onChange={() => togglePoolValue('builtinIds', preset.id)}
                  aria-label={`随机池包含${preset.name}`}
                />
              </label>
            </div>
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
            onClick={() => fileInputRef.current?.click()}
          >
            选择图片并裁剪
          </button>
          <span className="field__help">
            支持 PNG / JPEG / WebP，最大 10 MB，保存在本机浏览器中
          </span>
        </div>
      </div>

      {libraryAssets.length > 0 && (
        <>
          <span className="field__label">我的壁纸</span>
          <ul className="wallpaper-library">
            {libraryAssets.map((asset) => (
              <li
                key={asset.id}
                className={`wallpaper-library__item${activeUploadAssetId === asset.id ? ' wallpaper-library__item--active' : ''}`}
              >
                <img className="wallpaper-library__thumb" src={thumbnailUrls[asset.id]} alt="" />
                <span className="wallpaper-library__name" title={asset.name}>
                  {asset.name}
                </span>
                <div className="wallpaper-library__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => applyAsset(asset.id)}
                    disabled={activeUploadAssetId === asset.id}
                  >
                    {activeUploadAssetId === asset.id ? '使用中' : '使用'}
                  </button>
                  <label className="wallpaper-cell__check">
                    <input
                      type="checkbox"
                      checked={pool.assetIds.includes(asset.id)}
                      onChange={() => togglePoolValue('assetIds', asset.id)}
                      aria-label={`随机池包含 ${asset.name}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="wallpaper-library__delete"
                    aria-label={`删除 ${asset.name}`}
                    onClick={() => void deleteAsset(asset)}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

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

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      {pendingCrop && (
        <WallpaperCropDialog
          file={pendingCrop}
          onConfirm={(input) => void handleCropConfirm(input)}
          onCancel={() => setPendingCrop(null)}
        />
      )}
    </div>
  )
}
