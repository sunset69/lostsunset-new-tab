import { DEFAULT_WALLPAPER, findBuiltinImage } from '../config/builtin-wallpapers'
import type { UserConfig, WallpaperConfig, WallpaperRandomPool } from '../models/config'
import type { WallpaperAsset } from '../models/asset'
import type { AssetStore } from '../storage/asset-store'
import { createId } from '../utils/id'
import type { AppError, AsyncResult } from '../utils/result'
import { fail, ok } from '../utils/result'

/**
 * 壁纸业务服务（设计文档 6.1 / 6.4；0001 改善项 1/2/3）。
 * 负责把配置解析为可渲染描述符、上传校验落库（壁纸库保留多资产）、
 * 显式删除与缺失回退；随机模式在每次打开新标签页时抽签、不落盘。
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

/** 入库的图片输入：直接上传时由 File 派生；裁剪后由 Canvas 产出。 */
export type WallpaperImageInput = {
  blob: Blob
  mimeType: string
  name: string
  width?: number
  height?: number
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
  random: () => number = Math.random,
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

  if (wallpaper.mode === 'random') {
    return resolveRandom(wallpaper, assetStore, random)
  }

  // upload 模式：资产缺失（例如新设备恢复备份）时回退默认渐变。
  const assetId = wallpaper.assetId ?? wallpaper.value
  const asset = await assetStore.get(assetId)
  if (!asset) {
    return { ...fallback(), recovered: true }
  }
  return { descriptor: { kind: 'image', source: 'upload', blob: asset.blob }, recovered: false }
}

type RandomCandidate =
  | { kind: 'gradient'; value: string }
  | { kind: 'builtin'; value: string }
  | { kind: 'asset'; value: string }

async function resolveRandom(
  wallpaper: WallpaperConfig,
  assetStore: AssetStore,
  random: () => number,
): Promise<ResolvedWallpaper> {
  const pool = wallpaper.randomPool ?? { gradients: [], builtinIds: [], assetIds: [] }
  const candidates: RandomCandidate[] = [
    ...pool.gradients.map((value): RandomCandidate => ({ kind: 'gradient', value })),
    ...pool.builtinIds.map((value): RandomCandidate => ({ kind: 'builtin', value })),
    ...pool.assetIds.map((value): RandomCandidate => ({ kind: 'asset', value })),
  ]

  if (candidates.length === 0) {
    return fallback()
  }

  const pick = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]

  if (pick.kind === 'gradient') {
    return { descriptor: { kind: 'gradient', css: pick.value }, recovered: false }
  }
  if (pick.kind === 'builtin') {
    const preset = findBuiltinImage(pick.value)
    if (preset) {
      return { descriptor: { kind: 'image', source: 'builtin', url: preset.url }, recovered: false }
    }
    return fallback()
  }

  const asset = await assetStore.get(pick.value)
  if (!asset) {
    return { ...fallback(), recovered: true }
  }
  return { descriptor: { kind: 'image', source: 'upload', blob: asset.blob }, recovered: false }
}

/** 图片输入校验（设计文档 6.4 第 2 步；File 与裁剪产物共用）。 */
export function validateImageInput(
  input: WallpaperImageInput,
): AsyncResult<WallpaperImageInput, AppError> {
  if (!ALLOWED_WALLPAPER_MIME.has(input.mimeType)) {
    return fail({
      code: 'WALLPAPER_FILE_TYPE_UNSUPPORTED',
      message: WALLPAPER_ERROR_MESSAGES.WALLPAPER_FILE_TYPE_UNSUPPORTED,
    } satisfies AppError)
  }
  if (input.blob.size === 0) {
    return fail({
      code: 'WALLPAPER_FILE_EMPTY',
      message: WALLPAPER_ERROR_MESSAGES.WALLPAPER_FILE_EMPTY,
    } satisfies AppError)
  }
  if (input.blob.size > MAX_WALLPAPER_SIZE) {
    return fail({
      code: 'WALLPAPER_FILE_TOO_LARGE',
      message: WALLPAPER_ERROR_MESSAGES.WALLPAPER_FILE_TOO_LARGE,
      cause: { maxSize: MAX_WALLPAPER_SIZE, actualSize: input.blob.size },
    } satisfies AppError)
  }
  return ok(input)
}

/** 校验用户选取的文件（上传入口第一步，之后进入裁剪）。 */
export function validateImageFile(file: File): AsyncResult<{ blob: Blob; mimeType: string }> {
  return validateImageInput({ blob: file, mimeType: file.type, name: file.name })
}

/**
 * 把图片加入壁纸库并切换为当前壁纸（0001 改善 2）：
 * 校验 → 写入资产 → 切换配置引用。**不删除**任何旧资产，库中可多张复用。
 * 返回新的配置对象，不修改入参。
 */
export async function addWallpaperAsset(
  current: UserConfig,
  input: WallpaperImageInput,
  assetStore: AssetStore,
  now: Date = new Date(),
): Promise<AsyncResult<UserConfig>> {
  const checked = validateImageInput(input)
  if (!checked.ok) {
    return fail(checked.error)
  }

  const asset: WallpaperAsset = {
    id: createId('wallpaper'),
    blob: checked.data.blob,
    mimeType: checked.data.mimeType,
    name: checked.data.name,
    size: checked.data.blob.size,
    createdAt: now.toISOString(),
    width: checked.data.width,
    height: checked.data.height,
  }
  await assetStore.put(asset)

  const next: UserConfig = structuredClone(current)
  next.settings.wallpaper = {
    mode: 'upload',
    value: asset.id,
    assetId: asset.id,
    overlayOpacity: current.settings.wallpaper.overlayOpacity,
    randomPool: current.settings.wallpaper.randomPool,
  }
  return ok(next)
}

/**
 * 从壁纸库删除资产（0001 改善 2）。
 * 若删除的是当前使用中的壁纸，先把配置回退为默认渐变再删。
 */
export async function removeWallpaperAsset(
  current: UserConfig,
  assetId: string,
  assetStore: AssetStore,
): Promise<UserConfig> {
  const next: UserConfig = structuredClone(current)
  const wallpaper = next.settings.wallpaper
  const activeAssetId = wallpaper.mode === 'upload' ? (wallpaper.assetId ?? wallpaper.value) : null

  if (activeAssetId === assetId) {
    next.settings.wallpaper = {
      mode: 'gradient',
      value: DEFAULT_WALLPAPER.value,
      overlayOpacity: wallpaper.overlayOpacity,
      randomPool: wallpaper.randomPool,
    }
  }

  await assetStore.remove(assetId).catch(() => undefined)
  return next
}

/** 切换为渐变或内置图片预设，返回新配置（v2 起不再清理库中资产）。 */
export async function applyPresetWallpaper(
  current: UserConfig,
  preset:
    | { mode: 'gradient'; value: string }
    | { mode: 'builtin'; value: string },
): Promise<UserConfig> {
  const next: UserConfig = structuredClone(current)
  next.settings.wallpaper = {
    mode: preset.mode,
    value: preset.value,
    overlayOpacity: current.settings.wallpaper.overlayOpacity,
    randomPool: current.settings.wallpaper.randomPool,
  }
  return next
}

/** 更新随机池勾选（0001 改善 3），返回新配置；不修改入参。 */
export function setRandomPool(current: UserConfig, pool: WallpaperRandomPool): UserConfig {
  const next: UserConfig = structuredClone(current)
  next.settings.wallpaper.randomPool = pool
  return next
}

/** 调节遮罩不透明度，钳制在 0–1（设计文档 2.1.5 / 错误表）。 */
export function withOverlayOpacity(current: UserConfig, opacity: number): UserConfig {
  const clamped = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0.28
  const next = structuredClone(current)
  next.settings.wallpaper.overlayOpacity = clamped
  return next
}
