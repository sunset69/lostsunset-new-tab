import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../storage/memory-storage'
import { STORAGE_KEYS } from '../storage/storage-keys'
import type { WebDavProfile } from '../models/backup'
import { loadWebDavProfile, saveWebDavProfile } from './webdav-profile-store'

const profile: WebDavProfile = {
  baseUrl: 'http://127.0.0.1:8899/dav/',
  remotePath: 'backup.json',
  username: 'alice',
  credential: 'secret',
  rememberCredential: true,
}

describe('loadWebDavProfile', () => {
  it('未存储时返回 null', async () => {
    expect(await loadWebDavProfile(createMemoryStorage())).toBeNull()
  })

  it('内容损坏或缺字段时返回 null', async () => {
    const s1 = createMemoryStorage({ [STORAGE_KEYS.webdavProfile]: 'oops' })
    expect(await loadWebDavProfile(s1)).toBeNull()

    const s2 = createMemoryStorage({
      [STORAGE_KEYS.webdavProfile]: { baseUrl: 'http://x', remotePath: 'a.json' },
    })
    expect(await loadWebDavProfile(s2)).toBeNull()
  })

  it('补齐可选字段的默认值', async () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.webdavProfile]: {
        baseUrl: 'http://x',
        remotePath: 'a.json',
        username: 'bob',
      },
    })
    const loaded = await loadWebDavProfile(storage)
    expect(loaded).toEqual({
      baseUrl: 'http://x',
      remotePath: 'a.json',
      username: 'bob',
      credential: '',
      rememberCredential: false,
      lastUpdatedAt: undefined,
    })
  })
})

describe('saveWebDavProfile', () => {
  it('记住凭据时完整持久化并写入时间戳', async () => {
    const storage = createMemoryStorage()
    const saved = await saveWebDavProfile(
      storage,
      profile,
      new Date('2026-09-19T04:14:20.756Z'),
    )
    expect(saved.credential).toBe('secret')
    expect(saved.lastUpdatedAt).toBe('2026-09-19T04:14:20.756Z')

    const loaded = await loadWebDavProfile(storage)
    expect(loaded?.credential).toBe('secret')
    expect(loaded?.rememberCredential).toBe(true)
  })

  it('不记住凭据时落盘空密码，保留其他字段', async () => {
    const storage = createMemoryStorage()
    await saveWebDavProfile(storage, { ...profile, rememberCredential: false })

    const raw = await storage.get<WebDavProfile>(STORAGE_KEYS.webdavProfile)
    expect(raw?.credential).toBe('')
    expect(raw?.username).toBe('alice')

    const loaded = await loadWebDavProfile(storage)
    expect(loaded?.credential).toBe('')
    expect(loaded?.rememberCredential).toBe(false)
  })
})
