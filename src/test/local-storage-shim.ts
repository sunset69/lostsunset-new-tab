/**
 * Node 25 自带的 localStorage 是需要 --localstorage-file 的空壳，
 * jsdom 会透传它，jsdom 环境测试统一用本函数换成内存实现，
 * 以覆盖生产的 localStorageStorage 路径。
 */
export function installMemoryLocalStorage(): void {
  const map = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
      setItem: (key: string, value: string) => void map.set(key, String(value)),
      removeItem: (key: string) => void map.delete(key),
      clear: () => map.clear(),
      key: (index: number) => Array.from(map.keys())[index] ?? null,
      get length() {
        return map.size
      },
    },
  })
}
