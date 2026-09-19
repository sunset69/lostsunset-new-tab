import type { UserConfig } from '../models/config'
import { CONFIG_VERSION } from '../models/config'
import type { AppError, AsyncResult } from '../utils/result'
import { fail } from '../utils/result'
import { parseUserConfig } from './config-schema'

/**
 * 配置迁移（设计文档 6.1）。
 * 当前仅支持 v1；后续版本在此增加 version -> 升级函数链。
 */
export function migrateConfig(raw: unknown): AsyncResult<UserConfig, AppError> {
  if (typeof raw !== 'object' || raw === null) {
    return fail({ code: 'CONFIG_MIGRATE_FAILED', message: '配置不是有效的对象' })
  }

  const version = (raw as { version?: unknown }).version
  if (version !== CONFIG_VERSION) {
    return fail({
      code: 'CONFIG_VERSION_UNSUPPORTED',
      message: `不支持的配置版本：${String(version)}`,
      cause: { version },
    })
  }

  return parseUserConfig(raw)
}
