import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import { createMemoryStorage } from '../storage/memory-storage'
import { STORAGE_KEYS } from '../storage/storage-keys'
import {
  backupFileName,
  createBackup,
  parseBackup,
  parseBackupText,
  saveLocalAutoBackup,
  summarizeBackup,
} from './backup-service'

const now = new Date('2026-09-19T03:00:00.000Z')

function backupFixture() {
  return createBackup(createDefaultConfig(now), now)
}

describe('createBackup', () => {
  it('生成符合备份文件格式的对象，且不写入凭据/资产字段', () => {
    const backup = backupFixture()
    expect(backup.kind).toBe('lostsunset-new-tab-backup')
    expect(backup.backupVersion).toBe(1)
    expect(backup.exportedAt).toBe(now.toISOString())
    expect(backup.appVersion).toBeTypeOf('string')
    expect(backup.appVersion.length).toBeGreaterThan(0)
    expect(backup.config.settings.wallpaper).toBeTruthy()
    expect('credential' in backup).toBe(false)
  })

  it('不修改传入的配置对象', () => {
    const config = createDefaultConfig(now)
    const backup = createBackup(config, now)
    expect(backup.config).toEqual(config)
  })
})

describe('parseBackup', () => {
  it('合法备份通过校验', () => {
    const result = parseBackup(backupFixture())
    expect(result.ok).toBe(true)
  })

  it('拒绝非对象输入', () => {
    expect(parseBackup(null).ok).toBe(false)
    expect(parseBackup('x').ok).toBe(false)
    expect(parseBackup([]).ok).toBe(false)
  })

  it('拒绝 kind 不匹配的文件', () => {
    const result = parseBackup({ ...backupFixture(), kind: 'other-backup' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BACKUP_INVALID')
  })

  it('拒绝不支持的备份版本', () => {
    const result = parseBackup({ ...backupFixture(), backupVersion: 99 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BACKUP_VERSION_UNSUPPORTED')
  })

  it('拒绝非法的 exportedAt', () => {
    const result = parseBackup({ ...backupFixture(), exportedAt: 'not-a-date' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BACKUP_INVALID')
  })

  it('拒绝内嵌配置结构损坏的备份', () => {
    const fixture = backupFixture()
    const broken = {
      ...fixture,
      config: {
        ...fixture.config,
        settings: { ...fixture.config.settings, searchEngines: [] },
      },
    }
    const result = parseBackup(broken)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_SCHEMA_INVALID')
  })

  it('v1 旧备份的内嵌配置经迁移后通过校验', () => {
    const legacy = {
      ...backupFixture(),
      config: {
        version: 1,
        updatedAt: now.toISOString(),
        settings: {
          activeEnvironmentId: 'env-default',
          searchEngine: {
            id: 'bing',
            name: 'Bing',
            searchUrlTemplate: 'https://www.bing.com/search?q={{query}}',
          },
          wallpaper: { mode: 'gradient', value: 'g', overlayOpacity: 0.28 },
          dock: { iconSize: 44, showLabels: false },
        },
        environments: [{ id: 'env-default', name: '默认环境', variables: {} }],
        shortcutGroups: [{ id: 'group-default', name: '常用网站', order: 0 }],
        shortcuts: [],
      },
    }
    const result = parseBackup(legacy)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.config.version).toBe(2)
      expect(result.data.config.settings.searchEngines).toHaveLength(1)
    }
  })

  it('宽容未知附加字段并补默认 appVersion', () => {
    const raw = { ...backupFixture(), appVersion: undefined, extra: true }
    const result = parseBackup(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.appVersion).toBe('unknown')
  })
})

describe('parseBackupText', () => {
  it('合法 JSON 文本可往返', () => {
    const result = parseBackupText(JSON.stringify(backupFixture()))
    expect(result.ok).toBe(true)
  })

  it('非 JSON 文本返回 BACKUP_INVALID 而非抛异常', () => {
    const result = parseBackupText('<<<not json>>>')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BACKUP_INVALID')
  })
})

describe('summarizeBackup', () => {
  it('统计环境、分组与快捷方式数量并提取壁纸模式', () => {
    const backup = backupFixture()
    backup.config.environments.push({
      id: 'env-2',
      name: '办公',
      variables: { baseUrl: 'http://10.0.0.1' },
    })
    backup.config.shortcuts.push({
      id: 's1',
      groupId: 'group-default',
      title: '后台',
      urlTemplate: '{{baseUrl}}/admin',
      icon: { type: 'favicon', value: '' },
      order: 0,
    })
    const summary = summarizeBackup(backup)
    expect(summary.environmentCount).toBe(2)
    expect(summary.shortcutCount).toBe(1)
    expect(summary.shortcutGroupCount).toBe(1)
    expect(summary.searchEngineName).toBe('Bing')
    expect(summary.wallpaperMode).toBe('gradient')
    expect(summary.exportedAt).toBe(now.toISOString())
  })
})

describe('saveLocalAutoBackup', () => {
  it('导入前把当前配置写入回滚键并记录原因', async () => {
    const storage = createMemoryStorage()
    const config = createDefaultConfig(now)
    await saveLocalAutoBackup(storage, config, 'manual-import', now)
    const snapshot = await storage.get<{ savedAt: string; reason: string; config: unknown }>(
      STORAGE_KEYS.localBackupBeforeImport,
    )
    expect(snapshot).not.toBeNull()
    expect(snapshot!.reason).toBe('manual-import')
    expect(snapshot!.savedAt).toBe(now.toISOString())
    expect(snapshot!.config).toEqual(config)
  })

  it('WebDAV 恢复使用独立原因标记', async () => {
    const storage = createMemoryStorage()
    await saveLocalAutoBackup(storage, createDefaultConfig(now), 'webdav-restore', now)
    const snapshot = await storage.get<{ reason: string }>(
      STORAGE_KEYS.localBackupBeforeImport,
    )
    expect(snapshot!.reason).toBe('webdav-restore')
  })
})

describe('backupFileName', () => {
  it('生成带日期的固定文件名', () => {
    expect(backupFileName(now)).toBe('lostsunset-new-tab-backup-2026-09-19.json')
  })
})
