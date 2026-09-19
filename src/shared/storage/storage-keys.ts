/**
 * chrome.storage.local 的键名集中管理，详见设计文档 5.3。
 */
export const STORAGE_KEYS = {
  userConfig: 'userConfig.v1',
  webdavProfile: 'webdavProfile.v1',
  localBackupBeforeImport: 'localBackup.beforeImport',
  corruptedConfigSnapshot: 'diagnostics.corruptedConfig',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
