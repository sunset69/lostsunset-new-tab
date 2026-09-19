import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import {
  BUILTIN_IMAGE_PRESETS,
  DEFAULT_WALLPAPER,
  GRADIENT_PRESETS,
} from '../config/builtin-wallpapers'
import type { WallpaperAsset } from '../models/asset'
import { createMemoryAssetStore } from '../storage/memory-asset-store'
import {
  MAX_WALLPAPER_SIZE,
  addWallpaperAsset,
  applyPresetWallpaper,
  removeWallpaperAsset,
  resolveWallpaper,
  setRandomPool,
  validateImageFile,
  withOverlayOpacity,
} from './wallpaper-service'

function makeFile(type: string, size: number, name = 'photo.png'): File {
  const bytes = new Uint8Array(size)
  return new File([bytes], name, { type })
}

function makeAsset(id: string, overrides: Partial<WallpaperAsset> = {}): WallpaperAsset {
  return {
    id,
    blob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
    mimeType: 'image/png',
    name: `${id}.png`,
    size: 1,
    createdAt: '2026-09-19T00:00:00Z',
    ...overrides,
  }
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
    const asset = makeAsset('asset-1')
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

describe('resolveWallpaper random 模式', () => {
  function randomWallpaper(pool: {
    gradients?: string[]
    builtinIds?: string[]
    assetIds?: string[]
  }) {
    return {
      mode: 'random' as const,
      value: '',
      overlayOpacity: 0.3,
      randomPool: {
        gradients: pool.gradients ?? [],
        builtinIds: pool.builtinIds ?? [],
        assetIds: pool.assetIds ?? [],
      },
    }
  }

  it('池为空时回退默认渐变', async () => {
    const resolved = await resolveWallpaper(randomWallpaper({}), createMemoryAssetStore(), () => 0)
    expect(resolved.descriptor).toEqual({ kind: 'gradient', css: DEFAULT_WALLPAPER.value })
    expect(resolved.recovered).toBe(false)
  })

  it('按注入的 random 抽中渐变', async () => {
    const g2 = GRADIENT_PRESETS[1].value
    const resolved = await resolveWallpaper(
      randomWallpaper({ gradients: [GRADIENT_PRESETS[0].value, g2] }),
      createMemoryAssetStore(),
      () => 0.6,
    )
    expect(resolved.descriptor).toEqual({ kind: 'gradient', css: g2 })
  })

  it('可抽中内置图与本地资产', async () => {
    const asset = makeAsset('a1')
    const store = createMemoryAssetStore({ a1: asset })
    // 候选顺序：gradients → builtinIds → assetIds；下标 0 渐变 / 1 内置 / 2 资产
    const wallpaper = randomWallpaper({
      builtinIds: [BUILTIN_IMAGE_PRESETS[0].id],
      assetIds: ['a1'],
      gradients: [GRADIENT_PRESETS[0].value],
    })

    const gradientPick = await resolveWallpaper(wallpaper, store, () => 0)
    expect(gradientPick.descriptor).toEqual({
      kind: 'gradient',
      css: GRADIENT_PRESETS[0].value,
    })

    const builtinPick = await resolveWallpaper(wallpaper, store, () => 0.4)
    expect(builtinPick.descriptor).toEqual({
      kind: 'image',
      source: 'builtin',
      url: BUILTIN_IMAGE_PRESETS[0].url,
    })

    const assetPick = await resolveWallpaper(wallpaper, store, () => 0.8)
    expect(assetPick.descriptor).toEqual({ kind: 'image', source: 'upload', blob: asset.blob })
  })

  it('抽中的本地资产缺失时回退并标记 recovered', async () => {
    const resolved = await resolveWallpaper(
      randomWallpaper({ assetIds: ['gone'] }),
      createMemoryAssetStore(),
      () => 0,
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

describe('addWallpaperAsset', () => {
  it('写入资产并把配置切换为 upload 模式，保留库中旧资产', async () => {
    const store = createMemoryAssetStore({ old: makeAsset('old') })
    const config = createDefaultConfig()
    config.settings.wallpaper = {
      mode: 'upload',
      value: 'old',
      assetId: 'old',
      overlayOpacity: 0.4,
    }

    const result = await addWallpaperAsset(
      config,
      { blob: new Blob([new Uint8Array(32)], { type: 'image/png' }), mimeType: 'image/png', name: 'new.png', width: 100, height: 50 },
      store,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.settings.wallpaper.mode).toBe('upload')
    const assetId = result.data.settings.wallpaper.assetId!
    expect(assetId).toMatch(/^wallpaper-/)
    const stored = await store.get(assetId)
    expect(stored?.mimeType).toBe('image/png')
    expect(stored?.size).toBe(32)
    expect(stored?.width).toBe(100)
    // 旧资产仍在库中（壁纸库可复用）。
    expect(await store.get('old')).toBeDefined()
    // 不修改入参。
    expect(config.settings.wallpaper.mode).toBe('upload')
  })

  it('非法输入不写资产也不改配置', async () => {
    const store = createMemoryAssetStore()
    const result = await addWallpaperAsset(
      createDefaultConfig(),
      { blob: new Blob([new Uint8Array(10)]), mimeType: 'image/gif', name: 'x.gif' },
      store,
    )
    expect(result.ok).toBe(false)
    expect(await store.list()).toHaveLength(0)
  })
})

describe('removeWallpaperAsset', () => {
  it('删除当前使用中的资产时先回退默认渐变', async () => {
    const store = createMemoryAssetStore({ a1: makeAsset('a1') })
    const config = createDefaultConfig()
    config.settings.wallpaper = {
      mode: 'upload',
      value: 'a1',
      assetId: 'a1',
      overlayOpacity: 0.4,
    }

    const next = await removeWallpaperAsset(config, 'a1', store)
    expect(next.settings.wallpaper.mode).toBe('gradient')
    expect(next.settings.wallpaper.value).toBe(DEFAULT_WALLPAPER.value)
    expect(await store.get('a1')).toBeUndefined()
    // 不修改入参。
    expect(config.settings.wallpaper.mode).toBe('upload')
  })

  it('删除非当前资产时配置不变', async () => {
    const store = createMemoryAssetStore({ a1: makeAsset('a1'), a2: makeAsset('a2') })
    const config = createDefaultConfig()
    config.settings.wallpaper = {
      mode: 'upload',
      value: 'a1',
      assetId: 'a1',
      overlayOpacity: 0.4,
    }

    const next = await removeWallpaperAsset(config, 'a2', store)
    expect(next.settings.wallpaper.mode).toBe('upload')
    expect(next.settings.wallpaper.assetId).toBe('a1')
    expect(await store.get('a2')).toBeUndefined()
  })
})

describe('applyPresetWallpaper', () => {
  it('切到内置预设且保留库中资产', async () => {
    const store = createMemoryAssetStore({ old: makeAsset('old') })
    const config = createDefaultConfig()
    config.settings.wallpaper = {
      mode: 'upload',
      value: 'old',
      assetId: 'old',
      overlayOpacity: 0.2,
    }

    const next = await applyPresetWallpaper(config, { mode: 'builtin', value: 'builtin-starry-night' })
    expect(next.settings.wallpaper.mode).toBe('builtin')
    expect(next.settings.wallpaper.assetId).toBeUndefined()
    expect(await store.get('old')).toBeDefined()
  })
})

describe('setRandomPool', () => {
  it('写入随机池且不修改入参', () => {
    const config = createDefaultConfig()
    const next = setRandomPool(config, { gradients: ['g'], builtinIds: [], assetIds: ['a'] })
    expect(next.settings.wallpaper.randomPool).toEqual({ gradients: ['g'], builtinIds: [], assetIds: ['a'] })
    expect(config.settings.wallpaper.randomPool).not.toEqual(next.settings.wallpaper.randomPool)
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
