import type {
  AutoBackupReason,
  BackupSummary,
  ConfigBackupFile,
  LocalAutoBackup,
} from '../models/backup'
import { BACKUP_KIND, BACKUP_VERSION } from '../models/backup'
import type { UserConfig } from '../models/config'
import type { KeyValueStorage } from '../storage/key-value-storage'
import { STORAGE_KEYS } from '../storage/storage-keys'
import { migrateConfig } from './migration'
import type { AppError, AsyncResult } from '../utils/result'
import { fail, ok } from '../utils/result'

/**
 * 备份文件生成、校验与导入前自动备份（设计文档 5.5 / 6.5 / 6.6）。
 * 规则：仅包含结构化配置；不含 WebDAV 凭据与壁纸二进制；
 * 导入必须先通过校验，且在覆盖当前配置前写入本地回滚副本。
 */

export const BACKUP_ERROR_MESSAGES: Record<string, string> = {
  BACKUP_INVALID: '文件不是有效的配置备份',
  BACKUP_VERSION_UNSUPPORTED: '备份版本过高或过低',
  CONFIG_SCHEMA_INVALID: '文件不是有效的配置备份',
  WEBDAV_REMOTE_INVALID: '远端文件不是有效备份',
}

function backupError(code: string, reason: string): AsyncResult<never, AppError> {
  return fail({ code, message: BACKUP_ERROR_MESSAGES[code] ?? '备份校验失败', cause: { reason } })
}

/** 生成备份文件对象；config 原样保留（含壁纸 assetId，但不含任何资产二进制）。 */
export function createBackup(config: UserConfig, now: Date = new Date()): ConfigBackupFile {
  return {
    kind: BACKUP_KIND,
    backupVersion: BACKUP_VERSION,
    appVersion: __APP_VERSION__,
    exportedAt: now.toISOString(),
    config,
  }
}

/** 校验任意来源（本地文件 / WebDAV 远端）的已解析 JSON。 */
export function parseBackup(raw: unknown): AsyncResult<ConfigBackupFile, AppError> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return backupError('BACKUP_INVALID', 'root-not-object')
  }
  const record = raw as Record<string, unknown>
  if (record.kind !== BACKUP_KIND) {
    return backupError('BACKUP_INVALID', 'kind-mismatch')
  }
  if (record.backupVersion !== BACKUP_VERSION) {
    return backupError('BACKUP_VERSION_UNSUPPORTED', `backupVersion=${String(record.backupVersion)}`)
  }
  if (typeof record.exportedAt !== 'string' || !Number.isFinite(Date.parse(record.exportedAt))) {
    return backupError('BACKUP_INVALID', 'exported-at-invalid')
  }

  // 旧版本配置（如 v1）经迁移链自动升级后再校验。
  const parsedConfig = migrateConfig(record.config)
  if (!parsedConfig.ok) {
    const { code, message, cause } = parsedConfig.error
    return fail({ code, message: BACKUP_ERROR_MESSAGES[code] ?? message, cause })
  }

  return ok({
    kind: BACKUP_KIND,
    backupVersion: BACKUP_VERSION,
    appVersion: typeof record.appVersion === 'string' ? record.appVersion : 'unknown',
    exportedAt: record.exportedAt,
    config: parsedConfig.data,
  })
}

/** 读取并解析备份文件文本；JSON 解析失败同样拒绝且不覆盖当前配置。 */
export function parseBackupText(text: string): AsyncResult<ConfigBackupFile, AppError> {
  try {
    return parseBackup(JSON.parse(text))
  } catch {
    return backupError('BACKUP_INVALID', 'json-parse-failed')
  }
}

/** 导入确认页展示的结构化摘要。 */
export function summarizeBackup(backup: ConfigBackupFile): BackupSummary {
  const { settings, environments, shortcutGroups, shortcuts } = backup.config
  return {
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
    environmentCount: environments.length,
    shortcutGroupCount: shortcutGroups.length,
    shortcutCount: shortcuts.length,
    searchEngineName:
      settings.searchEngines.find((engine) => engine.id === settings.activeSearchEngineId)?.name ??
      settings.searchEngines[0]?.name ??
      '',
    wallpaperMode: settings.wallpaper.mode,
  }
}

/** 备份文件名：lostsunset-new-tab-backup-YYYY-MM-DD.json。 */
export function backupFileName(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10)
  return `lostsunset-new-tab-backup-${day}.json`
}

/**
 * 覆盖当前配置前的安全回滚副本（设计文档 6.6 第 4 步 / 6.8 第 5 步）。
 * 只保留最近一次。
 */
export async function saveLocalAutoBackup(
  storage: KeyValueStorage,
  config: UserConfig,
  reason: AutoBackupReason,
  now: Date = new Date(),
): Promise<void> {
  const snapshot: LocalAutoBackup = {
    savedAt: now.toISOString(),
    reason,
    config,
  }
  await storage.set(STORAGE_KEYS.localBackupBeforeImport, snapshot)
}
