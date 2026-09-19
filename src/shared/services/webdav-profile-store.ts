import type { WebDavProfile } from '../models/backup'
import type { KeyValueStorage } from '../storage/key-value-storage'
import { STORAGE_KEYS } from '../storage/storage-keys'

/**
 * WebDAV 连接信息存取（设计文档 5.2 / 5.4）。
 * 与 UserConfig 分离保存；用户不选择记住凭据时，只保留用户名等非敏感字段。
 */
export async function loadWebDavProfile(
  storage: KeyValueStorage,
): Promise<WebDavProfile | null> {
  const raw = await storage.get<unknown>(STORAGE_KEYS.webdavProfile)
  if (typeof raw !== 'object' || raw === null) {
    return null
  }
  const record = raw as Partial<WebDavProfile>
  if (
    typeof record.baseUrl !== 'string' ||
    typeof record.remotePath !== 'string' ||
    typeof record.username !== 'string'
  ) {
    return null
  }
  return {
    baseUrl: record.baseUrl,
    remotePath: record.remotePath,
    username: record.username,
    credential: typeof record.credential === 'string' ? record.credential : '',
    rememberCredential: record.rememberCredential === true,
    lastUpdatedAt: typeof record.lastUpdatedAt === 'string' ? record.lastUpdatedAt : undefined,
  }
}

/**
 * 持久化已校验的配置。
 * rememberCredential=false 时写入空凭据，下次打开需重新输入。
 */
export async function saveWebDavProfile(
  storage: KeyValueStorage,
  profile: WebDavProfile,
  now: Date = new Date(),
): Promise<WebDavProfile> {
  const stored: WebDavProfile = {
    ...profile,
    credential: profile.rememberCredential ? profile.credential : '',
    lastUpdatedAt: now.toISOString(),
  }
  await storage.set(STORAGE_KEYS.webdavProfile, stored)
  return stored
}
