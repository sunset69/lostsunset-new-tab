import { createDefaultConfig } from '../config/default-config'
import type { KeyValueStorage } from '../storage/key-value-storage'
import { STORAGE_KEYS } from '../storage/storage-keys'
import type { UserConfig } from '../models/config'
import type { AsyncResult } from '../utils/result'
import { ok } from '../utils/result'
import { migrateConfig } from './migration'

/**
 * 配置读写入口（设计文档 6.1）。
 * - 首次加载：写入默认配置；
 * - 已存在：迁移 + schema 校验；
 * - 校验失败：把原始数据另存为损坏快照，回退并持久化默认配置。
 */

export type ConfigLoadOutcome =
  | { status: 'loaded'; config: UserConfig }
  | { status: 'created'; config: UserConfig }
  | { status: 'recovered'; config: UserConfig }

export class ConfigStore {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly configKey: string = STORAGE_KEYS.userConfig,
    private readonly corruptedKey: string = STORAGE_KEYS.corruptedConfigSnapshot,
  ) {}

  async getOrCreate(now: Date = new Date()): Promise<ConfigLoadOutcome> {
    const raw = await this.storage.get<unknown>(this.configKey)

    if (raw === undefined) {
      const config = createDefaultConfig(now)
      await this.storage.set(this.configKey, config)
      return { status: 'created', config }
    }

    const migrated = migrateConfig(raw)
    if (migrated.ok) {
      return { status: 'loaded', config: migrated.data }
    }

    // 损坏数据不直接删除，保留快照便于排查/人工恢复。
    await this.storage.set(this.corruptedKey, {
      savedAt: now.toISOString(),
      reason: migrated.error.code,
      data: raw,
    })
    const fallback = createDefaultConfig(now)
    await this.storage.set(this.configKey, fallback)
    return { status: 'recovered', config: fallback }
  }

  /** 保存配置；updatedAt 由存储层统一打戳，返回持久化后的配置。 */
  async save(config: UserConfig, now: Date = new Date()): Promise<AsyncResult<UserConfig>> {
    const stamped: UserConfig = { ...config, updatedAt: now.toISOString() }
    await this.storage.set(this.configKey, stamped)
    return ok(stamped)
  }
}
