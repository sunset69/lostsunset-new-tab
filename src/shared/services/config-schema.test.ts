import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import { parseUserConfig } from './config-schema'
import { migrateConfig } from './migration'

describe('parseUserConfig', () => {
  it('接受默认配置', () => {
    const result = parseUserConfig(createDefaultConfig())
    expect(result.ok).toBe(true)
  })

  it('宽容未知附加字段', () => {
    const raw = { ...createDefaultConfig(), futureField: { x: 1 } }
    expect(parseUserConfig(raw).ok).toBe(true)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'config'],
  ])('拒绝非对象根值: %s', (_label, raw) => {
    const result = parseUserConfig(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_SCHEMA_INVALID')
  })

  it('拒绝错误版本号', () => {
    const raw = { ...createDefaultConfig(), version: 99 }
    const result = parseUserConfig(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.cause).toMatchObject({ reason: 'unsupported-version' })
  })

  it('拒绝空的环境名称', () => {
    const config = createDefaultConfig()
    config.environments[0].name = '  '
    expect(parseUserConfig(config).ok).toBe(false)
  })

  it('拒绝非字符串的环境变量值', () => {
    const config = createDefaultConfig()
    config.environments[0].variables = { baseUrl: 8080 as unknown as string }
    expect(parseUserConfig(config).ok).toBe(false)
  })

  it('拒绝非法的图标类型', () => {
    const config = createDefaultConfig()
    config.shortcuts.push({
      id: 's1',
      groupId: 'group-default',
      title: 'X',
      urlTemplate: 'https://x.com',
      icon: { type: 'evil' as 'favicon', value: '' },
      order: 0,
    })
    expect(parseUserConfig(config).ok).toBe(false)
  })

  it('接受自定义图片 URL 图标类型', () => {
    const config = createDefaultConfig()
    config.shortcuts.push({
      id: 's1',
      groupId: 'group-default',
      title: 'X',
      urlTemplate: 'https://x.com',
      icon: { type: 'image', value: 'https://cdn.example.com/a.png' },
      order: 0,
    })
    expect(parseUserConfig(config).ok).toBe(true)
  })

  it('缺少 clock 字段（旧配置）仍然通过', () => {
    const config = createDefaultConfig()
    delete config.settings.clock
    expect(parseUserConfig(config).ok).toBe(true)
  })

  it('接受合法的时钟位置', () => {
    const config = createDefaultConfig()
    config.settings.clock = { position: 'middle-center' }
    expect(parseUserConfig(config).ok).toBe(true)
  })

  it('拒绝非法的时钟位置', () => {
    const config = createDefaultConfig()
    config.settings.clock = { position: 'left' as 'bottom-left' }
    expect(parseUserConfig(config).ok).toBe(false)
  })

  it('拒绝非数组的 shortcuts', () => {
    const raw = { ...createDefaultConfig(), shortcuts: {} }
    expect(parseUserConfig(raw).ok).toBe(false)
  })

  it('拒绝非法壁纸模式', () => {
    const config = createDefaultConfig()
    config.settings.wallpaper.mode = 'video' as 'gradient'
    expect(parseUserConfig(config).ok).toBe(false)
  })
})

describe('migrateConfig', () => {
  it('v1 配置直接解析通过', () => {
    const result = migrateConfig(createDefaultConfig())
    expect(result.ok).toBe(true)
  })

  it('未知版本返回版本不支持错误', () => {
    const result = migrateConfig({ version: 7 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_VERSION_UNSUPPORTED')
  })

  it('非对象返回迁移失败', () => {
    expect(migrateConfig(null).ok).toBe(false)
  })
})
