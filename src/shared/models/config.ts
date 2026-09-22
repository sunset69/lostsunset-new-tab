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

/** 固定壁纸引用（进入随机模式前记录，退出随机时恢复）。 */
export type WallpaperFixedRef = {
  mode: Exclude<WallpaperMode, 'random'>
  value: string
  assetId?: string
}

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
  /** mode='random' 时是否在画面上显示随机切换按钮（0003 改善 4）；缺省视为显示。 */
  randomButtonVisible?: boolean
  /** 进入随机模式前的固定壁纸（0003 改善 4），退出随机时恢复。 */
  lastFixed?: WallpaperFixedRef
}

export type DockConfig = {
  iconSize: number
  showLabels: boolean
  /** Dock 手动宽度（px，0003 改善 3）；缺省为自动铺满。 */
  width?: number
}

/** 时钟在主画面上的九宫格预设位置（0004 改善 3）。 */
export type ClockPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type ClockConfig = {
  position: ClockPosition
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

/**
 * favicon：取站点同源 /favicon.ico；emoji：表情字符；custom：名称首字兜底；
 * image：用户自定义图片 URL（0004 改善 2，加载失败回退名称首字）；builtin：预留。
 */
export type ShortcutIconType = 'favicon' | 'builtin' | 'emoji' | 'custom' | 'image'

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
  /** 时钟显示位置（0004 改善 3）；旧配置缺省时视为左下。 */
  clock?: ClockConfig
}

export type UserConfig = {
  version: typeof CONFIG_VERSION
  updatedAt: string
  settings: UserSettings
  environments: Environment[]
  shortcutGroups: ShortcutGroup[]
  shortcuts: Shortcut[]
}
