/**
 * 键值存储端口（设计文档 4.2 Browser Adapters）。
 * 业务层只依赖该接口，便于用内存实现做单元测试。
 */
export interface KeyValueStorage {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}
