import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import { migrateConfig } from './migration'

describe('migrateConfig', () => {
  it('非对象输入返回迁移失败', () => {
    for (const raw of [null, undefined, 'v1', 42, true]) {
      const result = migrateConfig(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('CONFIG_MIGRATE_FAILED')
    }
  })

  it('版本号不匹配时返回版本不支持并携带实际版本', () => {
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

  it('合法 v1 配置原样通过', () => {
    const config = createDefaultConfig()
    const result = migrateConfig(config)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual(config)
  })

  it('v1 但结构非法时返回结构校验失败', () => {
    const result = migrateConfig({ version: 1, settings: { nope: true } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_SCHEMA_INVALID')
  })
})
