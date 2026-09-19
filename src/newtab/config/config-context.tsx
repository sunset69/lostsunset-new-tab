import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { browserStorage } from '../../shared/storage/browser-storage'
import type { KeyValueStorage } from '../../shared/storage/key-value-storage'
import type { UserConfig } from '../../shared/models/config'
import { ConfigStore, type ConfigLoadOutcome } from '../../shared/services/config-store'

type ConfigContextValue = {
  ready: boolean
  config: UserConfig | null
  /** 启动时是否发生过损坏恢复（用于展示一次性提示）。 */
  recovered: boolean
  /** 以可变草稿方式更新配置并持久化；updatedAt 由存储层打戳。 */
  updateConfig: (mutator: (draft: UserConfig) => void) => Promise<void>
  /** 提交由外部服务（如壁纸上传）已生成的完整配置并持久化。 */
  commitConfig: (next: UserConfig) => Promise<void>
}

export const ConfigContext = createContext<ConfigContextValue | null>(null)

type ConfigProviderProps = {
  children: ReactNode
  /** 允许测试注入内存存储。 */
  storage?: KeyValueStorage
}

export function ConfigProvider({ children, storage = browserStorage }: ConfigProviderProps) {
  const storeRef = useRef<ConfigStore | null>(null)
  if (storeRef.current === null) {
    storeRef.current = new ConfigStore(storage)
  }

  const [config, setConfig] = useState<UserConfig | null>(null)
  const [recovered, setRecovered] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const outcome: ConfigLoadOutcome = await storeRef.current!.getOrCreate()
      if (cancelled) return
      setConfig(outcome.config)
      setRecovered(outcome.status === 'recovered')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateConfig = useCallback(
    async (mutator: (draft: UserConfig) => void) => {
      const current = config
      if (!current || !storeRef.current) {
        throw new Error('配置尚未加载完成')
      }
      const draft: UserConfig = structuredClone(current)
      mutator(draft)
      const saved = await storeRef.current.save(draft)
      if (saved.ok) {
        setConfig(saved.data)
      }
    },
    [config],
  )

  const commitConfig = useCallback(
    async (next: UserConfig) => {
      if (!storeRef.current) {
        throw new Error('配置尚未加载完成')
      }
      const saved = await storeRef.current.save(next)
      if (saved.ok) {
        setConfig(saved.data)
      }
    },
    [],
  )

  const value = useMemo<ConfigContextValue>(
    () => ({ ready: config !== null, config, recovered, updateConfig, commitConfig }),
    [config, recovered, updateConfig, commitConfig],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const value = useContext(ConfigContext)
  if (!value) {
    throw new Error('useConfig 必须在 <ConfigProvider> 内使用')
  }
  return value
}
