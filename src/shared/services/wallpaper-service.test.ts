import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import { DEFAULT_WALLPAPER } from '../config/builtin-wallpapers'
import type { WallpaperAsset } from '../models/asset'
import { createMemoryAssetStore } from '../storage/memory-asset-store'
import {
  MAX_WALLPAPER_SIZE,
  applyPresetWallpaper,
  resolveWallpaper,
  saveUploadedWallpaper,
  validateImageFile,
  withOverlayOpacity,
} from './wallpaper-service'

function makeFile(type: string, size: number, name = 'photo.png'): File {
  const bytes = new Uint8Array(size)
  return new File([bytes], name, { type })
}

describe('resolveWallpaper', () => {
  it('渐变模式直接返回 CSS', async () => {
    const config = createDefaultConfig()
    const resolved = await resolveWallpaper(config.settings.wallpaper, createMemoryAssetStore())
    expect(resolved.recovered).toBe(false)
    expect(resolved.descriptor).toEqual({
      kind: 'gradient',
      css: DEFAULT_WALLPAPER.value,
    })
  })

  it('内置图片模式返回预设 URL', async () => {
    const config = createDefaultConfig()
    config.settings.wallpaper = { mode: 'builtin', value: 'builtin-mountain-lake', overlayOpacity: 0.3 }
    const resolved = await resolveWallpaper(config.settings.wallpaper, createMemoryAssetStore())
    expect(resolved.descriptor.kind).toBe('image')
    if (resolved.descriptor.kind === 'image') {
      expect(resolved.descriptor.source).toBe('builtin')
      if (resolved.descriptor.source === 'builtin') {
        expect(resolved.descriptor.url).toContain('text_to_image')
      }
    }
  })

  it('未知内置 id 回退默认渐变', async () => {
    const config = createDefaultConfig()
    config.settings.wallpaper = { mode: 'builtin', value: 'missing', overlayOpacity: 0.3 }
    const resolved = await resolveWallpaper(config.settings.wallpaper, createMemoryAssetStore())
    expect(resolved.descriptor).toEqual({ kind: 'gradient', css: DEFAULT_WALLPAPER.value })
  })

  it('上传资产存在时返回 blob', async () => {
    const asset: WallpaperAsset = {
      id: 'asset-1',
      blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
      mimeType: 'image/png',
      name: 'p.png',
      size: 1,
      createdAt: '2026-09-19T00:00:00Z',
    }
    const store = createMemoryAssetStore({ 'asset-1': asset })
    const resolved = await resolveWallpaper(
      { mode: 'upload', value: 'asset-1', assetId: 'asset-1', overlayOpacity: 0.3 },
      store,
    )
    expect(resolved.recovered).toBe(false)
    expect(resolved.descriptor.kind).toBe('image')
    if (resolved.descriptor.kind === 'image') {
      expect(resolved.descriptor.source).toBe('upload')
      if (resolved.descriptor.source === 'upload') {
        expect(resolved.descriptor.blob).toBe(asset.blob)
      }
    }
  })

  it('上传资产缺失时回退并标记 recovered', async () => {
    const resolved = await resolveWallpaper(
      { mode: 'upload', value: 'gone', assetId: 'gone', overlayOpacity: 0.3 },
      createMemoryAssetStore(),
    )
    expect(resolved.recovered).toBe(true)
    expect(resolved.descriptor).toEqual({ kind: 'gradient', css: DEFAULT_WALLPAPER.value })
  })
})

describe('validateImageFile', () => {
  it('接受 png/jpeg/webp', () => {
    expect(validateImageFile(makeFile('image/png', 10)).ok).toBe(true)
    expect(validateImageFile(makeFile('image/jpeg', 10)).ok).toBe(true)
    expect(validateImageFile(makeFile('image/webp', 10)).ok).toBe(true)
  })

  it('拒绝不支持的类型', () => {
    const result = validateImageFile(makeFile('image/gif', 10))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WALLPAPER_FILE_TYPE_UNSUPPORTED')
  })

  it('拒绝空文件', () => {
    const result = validateImageFile(makeFile('image/png', 0))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WALLPAPER_FILE_EMPTY')
  })

  it('拒绝超过 10MB 的文件', () => {
    const result = validateImageFile(makeFile('image/png', MAX_WALLPAPER_SIZE + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WALLPAPER_FILE_TOO_LARGE')
  })
})

describe('saveUploadedWallpaper', () => {
  it('写入资产并把配置切换为 upload 模式', async () => {
    const store = createMemoryAssetStore()
    const config = createDefaultConfig()
    const result = await saveUploadedWallpaper(config, makeFile('image/png', 32), store)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.settings.wallpaper.mode).toBe('upload')
    const assetId = result.data.settings.wallpaper.assetId!
    expect(assetId).toMatch(/^wallpaper-/)
    const stored = await store.get(assetId)
    expect(stored?.mimeType).toBe('image/png')
    expect(stored?.size).toBe(32)
    // 不修改入参。
    expect(config.settings.wallpaper.mode).toBe('gradient')
  })

  it('替换旧壁纸时清理旧资产', async () => {
    const oldAsset: WallpaperAsset = {
      id: 'old',
      blob: new Blob(),
      mimeType: 'image/png',
      name: 'old.png',
      size: 1,
      createdAt: '2026-01-01T00:00:00Z',
    }
    const store = createMemoryAssetStore({ old: oldAsset })
    const config = createDefaultConfig()
    config.settings.wallpaper = { mode: 'upload', value: 'old', assetId: 'old', overlayOpacity: 0.4 }

    const result = await saveUploadedWallpaper(config, makeFile('image/jpeg', 16), store)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(await store.get('old')).toBeUndefined()
      expect(result.data.settings.wallpaper.overlayOpacity).toBe(0.4)
    }
  })

  it('非法文件不写资产也不改配置', async () => {
    const store = createMemoryAssetStore()
    const result = await saveUploadedWallpaper(createDefaultConfig(), makeFile('text/html', 10), store)
    expect(result.ok).toBe(false)
  })
})

describe('applyPresetWallpaper', () => {
  it('切到内置预设并清理旧上传资产', async () => {
    const store = createMemoryAssetStore({
      old: {
        id: 'old',
        blob: new Blob(),
        mimeType: 'image/png',
        name: 'o.png',
        size: 1,
        createdAt: '',
      },
    })
    const config = createDefaultConfig()
    config.settings.wallpaper = { mode: 'upload', value: 'old', assetId: 'old', overlayOpacity: 0.2 }

    const next = await applyPresetWallpaper(
      config,
      { mode: 'builtin', value: 'builtin-starry-night' },
      store,
    )
    expect(next.settings.wallpaper.mode).toBe('builtin')
    expect(next.settings.wallpaper.assetId).toBeUndefined()
    expect(await store.get('old')).toBeUndefined()
  })
})

describe('withOverlayOpacity', () => {
  it.each([
    [0.5, 0.5],
    [-1, 0],
    [2, 1],
    [Number.NaN, 0.28],
  ])('输入 %s -> %s', (input, expected) => {
    const next = withOverlayOpacity(createDefaultConfig(), input)
    expect(next.settings.wallpaper.overlayOpacity).toBe(expected)
  })
})
