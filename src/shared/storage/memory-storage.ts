import type { KeyValueStorage } from './key-value-storage'

/** 进程内内存存储，供单元测试与降级场景使用。 */
export function createMemoryStorage(initial: Record<string, unknown> = {}): KeyValueStorage {
  const map = new Map<string, unknown>(Object.entries(initial))

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined
    },
    async set(key: string, value: unknown): Promise<void> {
      map.set(key, value)
    },
    async remove(key: string): Promise<void> {
      map.delete(key)
    },
  }
}
