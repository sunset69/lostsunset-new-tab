import type { AppError, AsyncResult } from '../utils/result'
import { fail, ok } from '../utils/result'

/**
 * 环境 URL 解析（设计文档 2.1.3 / 6.2）。
 * 将 urlTemplate 中的 {{变量名}} 替换为当前环境变量值，
 * 替换后仅允许 http/https 协议。
 */

export type ResolveErrorCode =
  | 'TEMPLATE_EMPTY'
  | 'VARIABLE_NAME_INVALID'
  | 'VARIABLE_MISSING'
  | 'URL_INVALID'
  | 'PROTOCOL_UNSUPPORTED'

const TOKEN_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

/** 环境变量名规则：字母/下划线开头，后接字母数字下划线。 */
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export const RESOLVE_ERROR_MESSAGES: Record<ResolveErrorCode, string> = {
  TEMPLATE_EMPTY: '地址模板不能为空',
  VARIABLE_NAME_INVALID: '变量名只能包含字母、数字和下划线，且不能以数字开头',
  VARIABLE_MISSING: '当前环境缺少所需变量',
  URL_INVALID: '地址格式不正确',
  PROTOCOL_UNSUPPORTED: '仅支持 http 或 https 地址',
}

export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME_PATTERN.test(name)
}

function resolveError(
  code: ResolveErrorCode,
  cause?: Record<string, unknown>,
): AsyncResult<never, AppError> {
  return fail({ code, message: RESOLVE_ERROR_MESSAGES[code], cause })
}

/** 提取模板中出现的全部变量名（去重、按出现顺序）。 */
export function extractTemplateVariables(urlTemplate: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const match of urlTemplate.matchAll(new RegExp(TOKEN_PATTERN))) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

export function resolveShortcutUrl(
  urlTemplate: string,
  variables: Record<string, string>,
): AsyncResult<string, AppError> {
  const template = urlTemplate.trim()
  if (template === '') {
    return resolveError('TEMPLATE_EMPTY')
  }

  const missing: string[] = []
  const replaced = template.replace(new RegExp(TOKEN_PATTERN), (_token, name: string) => {
    const value = variables[name]
    if (value === undefined || value.trim() === '') {
      missing.push(name)
      return ''
    }
    return value
  })

  if (missing.length > 0) {
    return resolveError('VARIABLE_MISSING', { variable: missing[0] })
  }

  let url: URL
  try {
    url = new URL(replaced)
  } catch {
    return resolveError('URL_INVALID')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return resolveError('PROTOCOL_UNSUPPORTED', { protocol: url.protocol })
  }

  return ok(replaced)
}

/**
 * 编辑期校验 urlTemplate：
 * - 空模板交给必填校验；
 * - 含占位符时用样例值填充后校验整体合法性；
 * - 存在形如 {{foo bar}} 的非法占位符时，花括号残留会导致 URL 非法。
 */
export function validateUrlTemplate(urlTemplate: string): AsyncResult<true, AppError> {
  const template = urlTemplate.trim()
  if (template === '') {
    return resolveError('TEMPLATE_EMPTY')
  }

  const names = extractTemplateVariables(template)
  const sample: Record<string, string> = {}
  for (const name of names) {
    sample[name] = 'http://example.test'
  }

  const resolved = resolveShortcutUrl(template, sample)
  if (!resolved.ok) {
    if (resolved.error.code === 'VARIABLE_MISSING') {
      return resolveError('VARIABLE_NAME_INVALID')
    }
    return resolveError(resolved.error.code as ResolveErrorCode)
  }

  return ok(true)
}
