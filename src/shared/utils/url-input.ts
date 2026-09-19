/**
 * 快捷添加弹窗的 URL 输入规范化（0001 改善 6 设计 4.1）。
 * 纯函数：补协议、仅允许 http/https。
 */

export const ALLOWED_SHORTCUT_PROTOCOLS = new Set(['http:', 'https:'])

export type UrlNormalizeResult = { url: string } | { error: string }

/** 显式 scheme 前缀（含 javascript: 这类不带 // 的形式）。 */
const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/
/** 形如「xxx://」但 xxx 不是合法 scheme 字符（如 ht!tp://）。 */
const INTENDED_SCHEME_RE = /^[^/?#:]*:\/\//

/** 前缀像主机名（localhost 或含点），视为 host:port 而非 scheme。 */
function looksLikeHost(prefix: string): boolean {
  return prefix === 'localhost' || prefix.includes('.')
}

/** 规范化用户输入的网址：trim、缺协议补 https://、校验协议白名单。 */
export function normalizeUrlInput(input: string): UrlNormalizeResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { error: '网址不能为空' }
  }

  let candidate: string
  const schemeMatch = SCHEME_RE.exec(trimmed)
  if (schemeMatch && !looksLikeHost(schemeMatch[1])) {
    // 显式 scheme（javascript: / ftp:// 等），交给 URL 解析 + 白名单校验。
    candidate = trimmed
  } else if (!schemeMatch && INTENDED_SCHEME_RE.test(trimmed)) {
    // ht!tp://bad：意图写 scheme 但格式非法。
    return { error: '网址格式不正确' }
  } else {
    // 缺协议，或前缀是主机名+端口（localhost:3000）→ 补 https。
    candidate = `https://${trimmed}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { error: '网址格式不正确' }
  }

  if (!ALLOWED_SHORTCUT_PROTOCOLS.has(url.protocol)) {
    return { error: '仅支持 http 或 https 地址' }
  }
  return { url: url.toString() }
}

/** 由规范化后的 URL 提取默认名称（去 www 前缀的 hostname）。 */
export function defaultTitleFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '') || hostname
  } catch {
    return ''
  }
}
