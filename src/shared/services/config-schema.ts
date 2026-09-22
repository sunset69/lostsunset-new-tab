import type {
  Environment,
  SearchEngine,
  Shortcut,
  ShortcutGroup,
  UserConfig,
  WallpaperMode,
} from '../models/config'
import { CONFIG_VERSION } from '../models/config'
import type { AppError, AsyncResult } from '../utils/result'
import { fail, ok } from '../utils/result'
import { isValidSearchTemplate } from '../utils/url-search'

/**
 * UserConfig 结构校验（设计文档 6.1）。
 * 手写轻量守卫，避免为加载链路引入额外依赖。
 * 校验只拒绝会导致 UI 崩溃或数据损坏的结构问题，宽容未知的附加字段。
 */

const WALLPAPER_MODES: readonly WallpaperMode[] = ['builtin', 'upload', 'gradient', 'random']
const ICON_TYPES = new Set(['favicon', 'builtin', 'emoji', 'custom', 'image'])
const CLOCK_POSITIONS = new Set([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function schemaError(reason: string): AsyncResult<never, AppError> {
  return fail({
    code: 'CONFIG_SCHEMA_INVALID',
    message: '配置结构校验失败',
    cause: { reason },
  })
}

function validateEnvironment(value: unknown): value is Environment {
  if (!isObject(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    return false
  }
  if (!isObject(value.variables)) {
    return false
  }
  return Object.values(value.variables).every((v) => typeof v === 'string')
}

function validateGroup(value: unknown): value is ShortcutGroup {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.order === 'number' &&
    Number.isFinite(value.order)
  )
}

function validateShortcut(value: unknown): value is Shortcut {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.groupId) ||
    !isNonEmptyString(value.title) ||
    typeof value.urlTemplate !== 'string' ||
    typeof value.order !== 'number' ||
    !Number.isFinite(value.order)
  ) {
    return false
  }
  if (!isObject(value.icon)) {
    return false
  }
  return (
    typeof value.icon.type === 'string' &&
    ICON_TYPES.has(value.icon.type) &&
    typeof value.icon.value === 'string'
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function validateSearchEngine(value: unknown): value is SearchEngine {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.searchUrlTemplate) &&
    isValidSearchTemplate(value.searchUrlTemplate) &&
    (value.keyword === undefined || typeof value.keyword === 'string')
  )
}

/** 解析任意来源（chrome.storage / JSON 导入）的原始值。 */
export function parseUserConfig(raw: unknown): AsyncResult<UserConfig, AppError> {
  if (!isObject(raw)) {
    return schemaError('root-not-object')
  }
  if (raw.version !== CONFIG_VERSION) {
    return schemaError('unsupported-version')
  }
  if (typeof raw.updatedAt !== 'string') {
    return schemaError('updated-at-not-string')
  }

  const settings = raw.settings
  if (!isObject(settings) || !isNonEmptyString(settings.activeEnvironmentId)) {
    return schemaError('settings-invalid')
  }

  const searchEngines = settings.searchEngines
  if (
    !Array.isArray(searchEngines) ||
    searchEngines.length === 0 ||
    !searchEngines.every(validateSearchEngine)
  ) {
    return schemaError('search-engines-invalid')
  }
  if (
    !isNonEmptyString(settings.activeSearchEngineId) ||
    !searchEngines.some((engine) => engine.id === settings.activeSearchEngineId)
  ) {
    return schemaError('active-search-engine-invalid')
  }

  const wallpaper = settings.wallpaper
  if (
    !isObject(wallpaper) ||
    typeof wallpaper.mode !== 'string' ||
    !WALLPAPER_MODES.includes(wallpaper.mode as WallpaperMode) ||
    typeof wallpaper.value !== 'string' ||
    typeof wallpaper.overlayOpacity !== 'number' ||
    !Number.isFinite(wallpaper.overlayOpacity)
  ) {
    return schemaError('wallpaper-invalid')
  }

  const randomPool = wallpaper.randomPool
  if (
    randomPool !== undefined &&
    (!isObject(randomPool) ||
      !isStringArray(randomPool.gradients) ||
      !isStringArray(randomPool.builtinIds) ||
      !isStringArray(randomPool.assetIds))
  ) {
    return schemaError('wallpaper-random-pool-invalid')
  }

  if (
    wallpaper.randomButtonVisible !== undefined &&
    typeof wallpaper.randomButtonVisible !== 'boolean'
  ) {
    return schemaError('wallpaper-random-button-visible-invalid')
  }

  const lastFixed = wallpaper.lastFixed
  if (
    lastFixed !== undefined &&
    (!isObject(lastFixed) ||
      typeof lastFixed.mode !== 'string' ||
      !(['builtin', 'upload', 'gradient'] as readonly string[]).includes(lastFixed.mode) ||
      typeof lastFixed.value !== 'string' ||
      (lastFixed.assetId !== undefined && typeof lastFixed.assetId !== 'string'))
  ) {
    return schemaError('wallpaper-last-fixed-invalid')
  }

  const dock = settings.dock
  if (
    !isObject(dock) ||
    typeof dock.iconSize !== 'number' ||
    typeof dock.showLabels !== 'boolean' ||
    (dock.width !== undefined &&
      (typeof dock.width !== 'number' || !Number.isFinite(dock.width)))
  ) {
    return schemaError('dock-invalid')
  }

  const clock = settings.clock
  if (
    clock !== undefined &&
    (!isObject(clock) ||
      typeof clock.position !== 'string' ||
      !CLOCK_POSITIONS.has(clock.position))
  ) {
    return schemaError('clock-invalid')
  }

  if (!Array.isArray(raw.environments) || !raw.environments.every(validateEnvironment)) {
    return schemaError('environments-invalid')
  }
  if (
    !Array.isArray(raw.shortcutGroups) ||
    !raw.shortcutGroups.every(validateGroup)
  ) {
    return schemaError('shortcut-groups-invalid')
  }
  if (!Array.isArray(raw.shortcuts) || !raw.shortcuts.every(validateShortcut)) {
    return schemaError('shortcuts-invalid')
  }

  const config: UserConfig = raw as unknown as UserConfig
  return ok(config)
}
