/**
 * 备份与 WebDAV 领域模型（设计文档 5.4 / 5.5）。
 * 凭据与用户配置分离保存，且不进入备份文件。
 */
import type { UserConfig, WallpaperMode } from './config'

export const BACKUP_KIND = 'lostsunset-new-tab-backup' as const
export const BACKUP_VERSION = 1 as const

/** WebDAV 连接信息，独立于 UserConfig 存储（设计文档 5.4）。 */
export type WebDavProfile = {
  /** 服务根地址，例如 https://dav.example.com 或 http://192.168.1.20:5244 */
  baseUrl: string
  /** 远端备份文件路径，例如 /backup/lostsunset.json */
  remotePath: string
  username: string
  /** 应用专用密码或普通密码；rememberCredential 为 false 时存储层留空。 */
  credential: string
  rememberCredential: boolean
  lastUpdatedAt?: string
}

/** JSON 导入导出文件格式（设计文档 5.5）。 */
export type ConfigBackupFile = {
  kind: typeof BACKUP_KIND
  backupVersion: typeof BACKUP_VERSION
  /** 导出该文件的扩展版本，由构建期 __APP_VERSION__ 注入。 */
  appVersion: string
  exportedAt: string
  config: UserConfig
}

export type AutoBackupReason = 'manual-import' | 'webdav-restore'

/** 导入/恢复前写入本地的安全回滚副本（设计文档 6.6 第 4 步）。 */
export type LocalAutoBackup = {
  savedAt: string
  reason: AutoBackupReason
  config: UserConfig
}

/** 导入确认前展示给用户的摘要（设计文档 6.6 第 3 步）。 */
export type BackupSummary = {
  exportedAt: string
  appVersion: string
  environmentCount: number
  shortcutGroupCount: number
  shortcutCount: number
  searchEngineName: string
  wallpaperMode: WallpaperMode
}
