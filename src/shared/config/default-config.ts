import type { SearchEngine, UserConfig } from '../models/config'
import { CONFIG_VERSION } from '../models/config'
import { BUILTIN_IMAGE_PRESETS, GRADIENT_PRESETS } from './builtin-wallpapers'
import { createId } from '../utils/id'

/** 默认搜索引擎（设计文档 2.1.2；v2 起为列表首项）。 */
export const DEFAULT_SEARCH_ENGINE: SearchEngine = {
  id: 'bing',
  name: 'Bing',
  searchUrlTemplate: 'https://www.bing.com/search?q={{query}}',
  keyword: 'bing',
}

/** 引擎预设快速添加（0001 改善 4/5）。 */
export const SEARCH_ENGINE_PRESETS: SearchEngine[] = [
  DEFAULT_SEARCH_ENGINE,
  {
    id: 'baidu',
    name: '百度',
    searchUrlTemplate: 'https://www.baidu.com/s?wd={{query}}',
    keyword: 'baidu',
  },
  {
    id: 'google',
    name: 'Google',
    searchUrlTemplate: 'https://www.google.com/search?q={{query}}',
    keyword: 'google',
  },
  {
    id: 'ddg',
    name: 'DuckDuckGo',
    searchUrlTemplate: 'https://duckduckgo.com/?q={{query}}',
    keyword: 'ddg',
  },
]

export const DEFAULT_GROUP_ID = 'group-default'
export const DEFAULT_ENVIRONMENT_ID = 'env-default'

/** 默认渐变背景值（与 GRADIENT_PRESETS[0] 一致，独立常量避免循环依赖）。 */
const DEFAULT_WALLPAPER_GRADIENT = 'linear-gradient(140deg, #0b1020 0%, #2563eb 48%, #f59e0b 100%)'

/**
 * 生成一份全新的默认配置。
 * 每次调用生成新的 updatedAt；固定 id 便于首次安装后的可预测行为。
 */
export function createDefaultConfig(now: Date = new Date()): UserConfig {
  return {
    version: CONFIG_VERSION,
    updatedAt: now.toISOString(),
    settings: {
      activeEnvironmentId: DEFAULT_ENVIRONMENT_ID,
      searchEngines: [{ ...DEFAULT_SEARCH_ENGINE }],
      activeSearchEngineId: DEFAULT_SEARCH_ENGINE.id,
      wallpaper: {
        mode: 'gradient',
        value: DEFAULT_WALLPAPER_GRADIENT,
        overlayOpacity: 0.28,
        randomPool: {
          gradients: GRADIENT_PRESETS.map((preset) => preset.value),
          builtinIds: BUILTIN_IMAGE_PRESETS.map((preset) => preset.id),
          assetIds: [],
        },
      },
      dock: {
        iconSize: 44,
        showLabels: false,
      },
    },
    environments: [
      {
        id: DEFAULT_ENVIRONMENT_ID,
        name: '默认环境',
        color: '#38bdf8',
        variables: {},
      },
    ],
    shortcutGroups: [
      {
        id: DEFAULT_GROUP_ID,
        name: '常用网站',
        order: 0,
      },
    ],
    shortcuts: [],
  }
}

/** 生成空白环境的工厂（设置表单使用）。 */
export function createEnvironmentDraft(name: string) {
  return {
    id: createId('env'),
    name: name.trim() || '未命名环境',
    color: '#38bdf8',
    variables: {},
  }
}

/** 生成空白快捷方式的工厂（设置表单使用）。 */
export function createShortcutDraft(groupId: string, order: number) {
  return {
    id: createId('shortcut'),
    groupId,
    title: '',
    urlTemplate: '',
    icon: { type: 'favicon' as const, value: '' },
    order,
  }
}

/** 生成空白搜索引擎的工厂（设置表单使用，v2）。 */
export function createSearchEngineDraft() {
  return {
    id: createId('engine'),
    name: '',
    searchUrlTemplate: '',
    keyword: '',
  }
}
