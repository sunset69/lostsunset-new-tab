import { DEFAULT_WALLPAPER, findBuiltinImage } from '../config/builtin-wallpapers'
import type { UserConfig, WallpaperConfig } from '../models/config'
import type { WallpaperAsset } from '../models/asset'
import type { AssetStore } from '../storage/asset-store'
import { createId } from '../utils/id'
import type { AppError, AsyncResult } from '../utils/result'
import { fail, ok } from '../utils/result'

/**
 * 壁纸业务服务（设计文档 6.1 / 6.4）。
 * 负责把配置解析为可渲染描述符、上传校验落库、旧资产清理与缺失回退。
 */

export const ALLOWED_WALLPAPER_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
export const MAX_WALLPAPER_SIZE = 10 * 1024 * 1024
export const WALLPAPER_ERROR_MESSAGES = {
  WALLPAPER_FILE_TYPE_UNSUPPORTED: '仅支持 PNG、JPEG 或 WebP 格式的图片',
  WALLPAPER_FILE_TOO_LARGE: '图片不能超过 10 MB，请压缩后再上传',
  WALLPAPER_FILE_EMPTY: '图片文件为空',
} as const

export type WallpaperDescriptor =
  | { kind: 'gradient'; css: string }
  | { kind: 'image'; source: 'builtin'; url: string }
  | { kind: 'image'; source: 'upload'; blob: Blob }

export type ResolvedWallpaper = {
  descriptor: WallpaperDescriptor
  /** 上传资产在存储中缺失时为 true，UI 据此提示并回退默认背景。 */
  recovered: boolean
}

function fallback(): ResolvedWallpaper {
  return {
    descriptor: { kind: 'gradient', css: DEFAULT_WALLPAPER.value },
    recovered: false,
  }
}

/** 根据壁纸配置与资产存储解析当前应渲染的壁纸。 */
export async function resolveWallpaper(
  wallpaper: WallpaperConfig,
  assetStore: AssetStore,
): Promise<ResolvedWallpaper> {
  if (wallpaper.mode === 'gradient') {
    return { descriptor: { kind: 'gradient', css: wallpaper.value }, recovered: false }
  }

  if (wallpaper.mode === 'builtin') {
    const preset = findBuiltinImage(wallpaper.value)
    if (preset) {
      return { descriptor: { kind: 'image', source: 'builtin', url: preset.url }, recovered: false }
    }
    return fallback()
  }

  // upload 模式：资产缺失（例如新设备恢复备份）时回退默认渐变。
  const assetId = wallpaper.assetId ?? wallpaper.value
  const asset = await assetStore.get(assetId)
  if (!asset) {
    return { ...fallback(), recovered: true }
  }
  return { descriptor: { kind: 'image', source: 'upload', blob: asset.blob }, recovered: false }
}

/** 上传文件校验（设计文档 6.4 第 2 步）。 */
export function validateImageFile(file: File): AsyncResult<{ blob: Blob; mimeType: string }> {
  if (!ALLOWED_WALLPAPER_MIME.has(file.type)) {
    return fail({
      code: 'WALLPAPER_FILE_TYPE_UNSUPPORTED',
      message: WALLPAPER_ERROR_MESSAGES.WALLPAPER_FILE_TYPE_UNSUPPORTED,
    } satisfies AppError)
  }
  if (file.size === 0) {
    return fail({
      code: 'WALLPAPER_FILE_EMPTY',
      message: WALLPAPER_ERROR_MESSAGES.WALLPAPER_FILE_EMPTY,
    } satisfies AppError)
  }
  if (file.size > MAX_WALLPAPER_SIZE) {
    return fail({
      code: 'WALLPAPER_FILE_TOO_LARGE',
      message: WALLPAPER_ERROR_MESSAGES.WALLPAPER_FILE_TOO_LARGE,
      cause: { maxSize: MAX_WALLPAPER_SIZE, actualSize: file.size },
    } satisfies AppError)
  }
  return ok({ blob: file, mimeType: file.type })
}

/**
 * 保存上传壁纸（设计文档 6.4）：
 * 校验 → 写入资产 → 切换配置引用 → 尽力清理旧上传资产。
 * 返回新的配置对象，不修改入参。
 */
export async function saveUploadedWallpaper(
  current: UserConfig,
  file: File,
  assetStore: AssetStore,
  now: Date = new Date(),
): Promise<AsyncResult<UserConfig>> {
  const checked = validateImageFile(file)
  if (!checked.ok) {
    return fail(checked.error)
  }

  const asset: WallpaperAsset = {
    id: createId('wallpaper'),
    blob: checked.data.blob,
    mimeType: checked.data.mimeType,
    name: file.name,
    size: file.size,
    createdAt: now.toISOString(),
  }
  await assetStore.put(asset)

  const previousAssetId =
    current.settings.wallpaper.mode === 'upload'
      ? (current.settings.wallpaper.assetId ?? current.settings.wallpaper.value)
      : null

  const next: UserConfig = structuredClone(current)
  next.settings.wallpaper = {
    mode: 'upload',
    value: asset.id,
    assetId: asset.id,
    overlayOpacity: current.settings.wallpaper.overlayOpacity,
  }

  // 旧资产确认已无引用后清理；清理失败不阻断切换。
  if (previousAssetId && previousAssetId !== asset.id) {
    await assetStore.remove(previousAssetId).catch(() => undefined)
  }

  return ok(next)
}

/** 切换为渐变或内置图片预设，返回新配置；并清理被替换的上传资产。 */
export async function applyPresetWallpaper(
  current: UserConfig,
  preset:
    | { mode: 'gradient'; value: string }
    | { mode: 'builtin'; value: string },
  assetStore: AssetStore,
): Promise<UserConfig> {
  const previousAssetId =
    current.settings.wallpaper.mode === 'upload'
      ? (current.settings.wallpaper.assetId ?? current.settings.wallpaper.value)
      : null

  const next: UserConfig = structuredClone(current)
  next.settings.wallpaper = {
    mode: preset.mode,
    value: preset.value,
    overlayOpacity: current.settings.wallpaper.overlayOpacity,
  }

  if (previousAssetId) {
    await assetStore.remove(previousAssetId).catch(() => undefined)
  }
  return next
}

/** 调节遮罩不透明度，钳制在 0–1（设计文档 2.1.5 / 错误表）。 */
export function withOverlayOpacity(current: UserConfig, opacity: number): UserConfig {
  const clamped = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.28
  const next = structuredClone(current)
  next.settings.wallpaper.overlayOpacity = clamped
  return next
}
