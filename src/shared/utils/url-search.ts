/**
 * 搜索 URL 构建（设计文档 2.1.2）。
 * 纯函数：模板必须包含 {{query}}，查询词经过 encodeURIComponent 编码，
 * 最终地址仅允许 http/https 协议。
 */

export const SEARCH_QUERY_PLACEHOLDER = '{{query}}'

export const ALLOWED_SEARCH_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * 根据搜索引擎模板生成结果页 URL。
 * @returns 合法的 http/https URL；查询为空、模板缺失占位符或地址非法时返回 null。
 */
export function buildSearchUrl(searchUrlTemplate: string, query: string): string | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  if (!searchUrlTemplate.includes(SEARCH_QUERY_PLACEHOLDER)) return null

  let url: URL
  try {
    url = new URL(searchUrlTemplate.replace(SEARCH_QUERY_PLACEHOLDER, encodeURIComponent(trimmed)))
  } catch {
    return null
  }

  if (!ALLOWED_SEARCH_PROTOCOLS.has(url.protocol)) return null

  return url.toString()
}
