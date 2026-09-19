/**
 * 用户配置领域模型（设计文档第 5 节）。
 * 当前为 v2（0001 改善项）；v1 通过迁移链升级。
 */

export const CONFIG_VERSION = 2 as const

export type SearchEngine = {
  id: string
  name: string
  /** 必须包含 {{query}} 占位符，例如 https://www.bing.com/search?q={{query}} */
  searchUrlTemplate: string
  /** 输入该关键词 + 空格可临时切换到此引擎；空/缺省表示不支持。 */
  keyword?: string
}

export type WallpaperMode = 'builtin' | 'upload' | 'gradient' | 'random'

/** 随机壁纸候选池：三类来源各自勾选，抽签时合并。 */
export type WallpaperRandomPool = {
  gradients: string[]
  builtinIds: string[]
  assetIds: string[]
}

export type WallpaperConfig = {
  mode: WallpaperMode
  /** upload 模式下为 IndexedDB 中的资产 ID；builtin/gradient 下为对应资源标识或渐变值 */
  value: string
  assetId?: string
  /** 遮罩不透明度，取值 0-1，用于保证文字可读性 */
  overlayOpacity: number
  blur?: number
  /** mode='random' 时的抽签池；允许为空（运行时回退默认渐变）。 */
  randomPool?: WallpaperRandomPool
}

export type DockConfig = {
  iconSize: number
  showLabels: boolean
}

export type Environment = {
  id: string
  name: string
  color?: string
  /** 例如 { baseUrl: 'http://192.168.1.10:8080' } */
  variables: Record<string, string>
}

export type ShortcutGroup = {
  id: string
  name: string
  order: number
}

export type ShortcutIconType = 'favicon' | 'builtin' | 'emoji' | 'custom'

export type Shortcut = {
  id: string
  groupId: string
  title: string
  /** 完整 URL 或包含环境变量的模板，例如 {{baseUrl}}/admin */
  urlTemplate: string
  icon: {
    type: ShortcutIconType
    value: string
  }
  order: number
}

export type UserSettings = {
  activeEnvironmentId: string
  /** 可选搜索引擎列表（0001 改善 4/5）；activeSearchEngineId 必须指向其中一项。 */
  searchEngines: SearchEngine[]
  activeSearchEngineId: string
  wallpaper: WallpaperConfig
  dock: DockConfig
}

export type UserConfig = {
  version: typeof CONFIG_VERSION
  updatedAt: string
  settings: UserSettings
  environments: Environment[]
  shortcutGroups: ShortcutGroup[]
  shortcuts: Shortcut[]
}
