import type { SearchEngine, UserConfig } from '../models/config'
import { CONFIG_VERSION } from '../models/config'
import { createId } from '../utils/id'

/** 默认搜索引擎（设计文档 2.1.2）。 */
export const DEFAULT_SEARCH_ENGINE: SearchEngine = {
  id: 'bing',
  name: 'Bing',
  searchUrlTemplate: 'https://www.bing.com/search?q={{query}}',
}

export const DEFAULT_GROUP_ID = 'group-default'
export const DEFAULT_ENVIRONMENT_ID = 'env-default'

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
      searchEngine: { ...DEFAULT_SEARCH_ENGINE },
      wallpaper: {
        mode: 'gradient',
        value: 'linear-gradient(140deg, #0b1020 0%, #2563eb 48%, #f59e0b 100%)',
        overlayOpacity: 0.28,
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
