/**
 * 用户配置领域模型（设计文档第 5 节）。
 * 首期只包含 v1；后续版本通过显式迁移函数升级。
 */

export const CONFIG_VERSION = 1 as const

export type SearchEngine = {
  id: string
  name: string
  /** 必须包含 {{query}} 占位符，例如 https://www.bing.com/search?q={{query}} */
  searchUrlTemplate: string
}

export type WallpaperMode = 'builtin' | 'upload' | 'gradient'

export type WallpaperConfig = {
  mode: WallpaperMode
  /** upload 模式下为 IndexedDB 中的资产 ID；builtin/gradient 下为对应资源标识或渐变值 */
  value: string
  assetId?: string
  /** 遮罩不透明度，取值 0-1，用于保证文字可读性 */
  overlayOpacity: number
  blur?: number
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
  searchEngine: SearchEngine
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
