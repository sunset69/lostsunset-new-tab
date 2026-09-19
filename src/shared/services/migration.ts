import { BUILTIN_IMAGE_PRESETS, GRADIENT_PRESETS } from '../config/builtin-wallpapers'
import type { UserConfig } from '../models/config'
import { CONFIG_VERSION } from '../models/config'
import type { AppError, AsyncResult } from '../utils/result'
import { fail } from '../utils/result'
import { parseUserConfig } from './config-schema'

/**
 * 配置迁移（0001 改善项设计 1.2）。
 * 按 MIGRATIONS 步骤链逐级升级到当前版本，最后交给 parseUserConfig 校验。
 */

type MigrationStep = {
  from: number
  to: number
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>
}

const MIGRATIONS: MigrationStep[] = [{ from: 1, to: 2, migrate: migrateV1ToV2 }]

/** v1 引擎预设的默认 keyword 映射（大小写不敏感匹配 id/name）。 */
const KEYWORD_RULES: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /bing/i, keyword: 'bing' },
  { pattern: /baidu|百度/i, keyword: 'baidu' },
  { pattern: /google/i, keyword: 'google' },
  { pattern: /duckduckgo|^ddg$/i, keyword: 'ddg' },
]

function guessEngineKeyword(id: string, name: string): string | undefined {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(id) || rule.pattern.test(name)) return rule.keyword
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** v1 → v2：单引擎对象转列表、补默认 keyword、补默认随机池。 */
export function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const next = structuredClone(raw) as Record<string, unknown> & {
    version: number
    settings: Record<string, unknown>
  }
  next.version = 2

  const settings = isRecord(next.settings) ? next.settings : {}
  const legacy = isRecord(settings.searchEngine) ? settings.searchEngine : null

  const engines: Array<Record<string, unknown>> = []
  if (
    legacy &&
    typeof legacy.id === 'string' &&
    typeof legacy.name === 'string' &&
    typeof legacy.searchUrlTemplate === 'string'
  ) {
    const keyword = guessEngineKeyword(legacy.id, legacy.name)
    engines.push(keyword ? { ...legacy, keyword } : { ...legacy })
  }
  settings.searchEngines = engines
  settings.activeSearchEngineId = engines[0]?.id ?? ''
  delete settings.searchEngine

  const wallpaper = isRecord(settings.wallpaper) ? settings.wallpaper : null
  if (wallpaper && wallpaper.randomPool === undefined) {
    wallpaper.randomPool = {
      gradients: GRADIENT_PRESETS.map((preset) => preset.value),
      builtinIds: BUILTIN_IMAGE_PRESETS.map((preset) => preset.id),
      assetIds:
        wallpaper.mode === 'upload' && typeof wallpaper.value === 'string'
          ? [wallpaper.assetId ?? wallpaper.value]
          : [],
    }
  }

  next.settings = settings
  return next
}

/** 解析任意来源（chrome.storage / JSON 导入）的原始配置并升级到当前版本。 */
export function migrateConfig(raw: unknown): AsyncResult<UserConfig, AppError> {
  if (typeof raw !== 'object' || raw === null) {
    return fail({ code: 'CONFIG_MIGRATE_FAILED', message: '配置不是有效的对象' })
  }

  const version = (raw as { version?: unknown }).version
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > CONFIG_VERSION
  ) {
    return fail({
      code: 'CONFIG_VERSION_UNSUPPORTED',
      message: `不支持的配置版本：${String(version)}`,
      cause: { version },
    })
  }

  let current = raw as Record<string, unknown>
  let currentVersion = version
  while (currentVersion < CONFIG_VERSION) {
    const step = MIGRATIONS.find((candidate) => candidate.from === currentVersion)
    if (!step) {
      return fail({
        code: 'CONFIG_VERSION_UNSUPPORTED',
        message: `不支持的配置版本：${String(currentVersion)}`,
        cause: { version: currentVersion },
      })
    }
    try {
      current = step.migrate(current)
    } catch {
      return fail({ code: 'CONFIG_MIGRATE_FAILED', message: '配置迁移执行失败' })
    }
    currentVersion = step.to
  }

  return parseUserConfig(current)
}
