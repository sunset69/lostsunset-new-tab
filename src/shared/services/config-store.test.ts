import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../config/default-config'
import { createMemoryStorage } from '../storage/memory-storage'
import { STORAGE_KEYS } from '../storage/storage-keys'
import { ConfigStore } from './config-store'

describe('ConfigStore', () => {
  it('首次加载创建并持久化默认配置', async () => {
    const storage = createMemoryStorage()
    const store = new ConfigStore(storage)

    const outcome = await store.getOrCreate(new Date('2026-09-19T00:00:00Z'))
    expect(outcome.status).toBe('created')
    expect(outcome.config.environments).toHaveLength(1)

    const persisted = await storage.get(STORAGE_KEYS.userConfig)
    expect(persisted).toMatchObject({ version: 1 })
  })

  it('已存在的合法配置直接返回', async () => {
    const config = createDefaultConfig()
    config.settings.activeEnvironmentId = 'env-work'
    const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: config })
    const store = new ConfigStore(storage)

    const outcome = await store.getOrCreate()
    expect(outcome.status).toBe('loaded')
    expect(outcome.config.settings.activeEnvironmentId).toBe('env-work')
  })

  it('损坏配置保留快照并回退默认配置', async () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.userConfig]: { version: 1, wat: true },
    })
    const store = new ConfigStore(storage)

    const outcome = await store.getOrCreate()
    expect(outcome.status).toBe('recovered')
    expect(outcome.config.environments).toHaveLength(1)

    const snapshot = await storage.get(STORAGE_KEYS.corruptedConfigSnapshot)
    expect(snapshot).toMatchObject({
      reason: 'CONFIG_SCHEMA_INVALID',
      data: { version: 1, wat: true },
    })

    // 回退后主配置已被修复，再次加载应走 loaded 分支。
    const second = await store.getOrCreate()
    expect(second.status).toBe('loaded')
  })

  it('save 会更新 updatedAt 并写回存储', async () => {
    const storage = createMemoryStorage()
    const store = new ConfigStore(storage)
    const config = createDefaultConfig(new Date('2020-01-01T00:00:00Z'))

    await store.save(config, new Date('2026-09-19T12:30:00Z'))

    const persisted = await storage.get<{ updatedAt: string }>(STORAGE_KEYS.userConfig)
    expect(persisted?.updatedAt).toBe('2026-09-19T12:30:00.000Z')
  })
})
