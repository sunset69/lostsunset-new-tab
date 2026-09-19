import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import { BUILTIN_IMAGE_PRESETS, GRADIENT_PRESETS } from '../config/builtin-wallpapers'
import { migrateConfig, migrateV1ToV2 } from './migration'

/** 构造一份合法的 v1 配置（结构与旧版 createDefaultConfig 一致）。 */
function createV1Config(): Record<string, unknown> {
  return {
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: {
      activeEnvironmentId: 'env-default',
      searchEngine: {
        id: 'bing',
        name: 'Bing',
        searchUrlTemplate: 'https://www.bing.com/search?q={{query}}',
      },
      wallpaper: {
        mode: 'gradient',
        value: 'linear-gradient(140deg, #0b1020 0%, #2563eb 48%, #f59e0b 100%)',
        overlayOpacity: 0.28,
      },
      dock: { iconSize: 44, showLabels: false },
    },
    environments: [
      { id: 'env-default', name: '默认环境', color: '#38bdf8', variables: {} },
    ],
    shortcutGroups: [{ id: 'group-default', name: '常用网站', order: 0 }],
    shortcuts: [],
  }
}

describe('migrateConfig 基础', () => {
  it('非对象输入返回迁移失败', () => {
    for (const raw of [null, undefined, 'v1', 42, true]) {
      const result = migrateConfig(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('CONFIG_MIGRATE_FAILED')
    }
  })

  it('版本号超出范围时返回版本不支持并携带实际版本', () => {
    const result = migrateConfig({ version: 99 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_VERSION_UNSUPPORTED')
      expect((result.error.cause as { version: unknown }).version).toBe(99)
    }
  })

  it('缺失版本号视为不支持的版本', () => {
    const result = migrateConfig({ settings: {} })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_VERSION_UNSUPPORTED')
  })

  it('合法 v2 配置原样通过', () => {
    const config = createDefaultConfig()
    const result = migrateConfig(config)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual(config)
  })

  it('v2 但结构非法时返回结构校验失败', () => {
    const result = migrateConfig({ version: 2, settings: { nope: true } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_SCHEMA_INVALID')
  })
})

describe('migrateConfig v1 → v2', () => {
  it('v1 配置升级为 v2：引擎进列表、随机池默认全选', () => {
    const v1 = createV1Config()
    const result = migrateConfig(v1)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const config = result.data
    expect(config.version).toBe(2)
    expect(config.settings.searchEngines).toHaveLength(1)
    expect(config.settings.searchEngines[0].id).toBe('bing')
    expect(config.settings.searchEngines[0].keyword).toBe('bing')
    expect(config.settings.activeSearchEngineId).toBe('bing')
    expect((config.settings as Record<string, unknown>).searchEngine).toBeUndefined()
    expect(config.settings.wallpaper.randomPool).toEqual({
      gradients: GRADIENT_PRESETS.map((preset) => preset.value),
      builtinIds: BUILTIN_IMAGE_PRESETS.map((preset) => preset.id),
      assetIds: [],
    })
    // 其余字段保持不变。
    expect(config.environments).toEqual(v1.environments)
    expect(config.shortcuts).toEqual(v1.shortcuts)
  })

  it('v1 引擎按 id/name 映射默认 keyword', () => {
    const cases: Array<{ engine: Record<string, string>; keyword?: string }> = [
      {
        engine: { id: 'baidu', name: '百度', searchUrlTemplate: 'https://www.baidu.com/s?wd={{query}}' },
        keyword: 'baidu',
      },
      {
        engine: { id: 'g1', name: 'Google', searchUrlTemplate: 'https://www.google.com/search?q={{query}}' },
        keyword: 'google',
      },
      {
        engine: { id: 'ddg', name: 'DDG', searchUrlTemplate: 'https://duckduckgo.com/?q={{query}}' },
        keyword: 'ddg',
      },
      {
        // 未命中规则时不填 keyword。
        engine: { id: 'custom', name: '自建', searchUrlTemplate: 'https://s.example.com/?q={{query}}' },
      },
    ]

    for (const { engine, keyword } of cases) {
      const v1 = createV1Config()
      ;(v1.settings as { searchEngine: unknown }).searchEngine = engine
      const migrated = migrateV1ToV2(v1 as unknown as Record<string, unknown>)
      const engines = (
        (migrated.settings as { searchEngines: unknown }).searchEngines as Array<
          Record<string, unknown>
        >
      )
      expect(engines[0].keyword).toBe(keyword)
    }
  })

  it('v1 upload 模式时当前资产进入随机池', () => {
    const v1 = createV1Config()
    ;(v1.settings as Record<string, unknown>).wallpaper = {
      mode: 'upload',
      value: 'wallpaper-1',
      assetId: 'wallpaper-1',
      overlayOpacity: 0.3,
    }
    const result = migrateConfig(v1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.settings.wallpaper.randomPool?.assetIds).toEqual(['wallpaper-1'])
    }
  })

  it('结构非法的 v1 仍返回结构校验失败', () => {
    const result = migrateConfig({ version: 1, settings: { nope: true } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_SCHEMA_INVALID')
  })
})
