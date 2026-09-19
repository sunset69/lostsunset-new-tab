/**
 * 拖放链接解析（0001 改善 6 设计 4.2）。
 * 纯函数：从 DataTransfer 常见数据类型中解析出链接与可选标题。
 */

export type DroppedLinkData = {
  /** text/uri-list（\r\n 分隔，# 开头为注释）。 */
  uriList?: string
  /** text/html 片段（可含 <a href>）。 */
  html?: string
  /** text/plain 兜底。 */
  plain?: string
}

export type DroppedLink = { url: string; title?: string }

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

function isAllowedUrl(candidate: string): string | null {
  try {
    const url = new URL(candidate)
    // 返回原始字符串，保留用户输入（toString 会给裸域名补尾斜杠）。
    return ALLOWED_PROTOCOLS.has(url.protocol) ? candidate : null
  } catch {
    return null
  }
}

function parseUriList(uriList: string): string | null {
  for (const rawLine of uriList.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const url = isAllowedUrl(line)
    if (url) return url
  }
  return null
}

function parseHtmlAnchor(html: string): DroppedLink | null {
  const match = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i.exec(html)
  if (!match) return null
  const href = match[2] ?? match[3] ?? match[4] ?? ''
  const url = isAllowedUrl(href)
  if (!url) return null

  const title =
    /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ||
    match[5]?.replace(/<[^>]*>/g, '').trim() ||
    ''
  return { url, title: title || undefined }
}

/** 按优先级解析拖入内容：uri-list → html 锚点 → plain 文本。 */
export function parseDroppedLink(data: DroppedLinkData): DroppedLink | null {
  if (data.uriList) {
    const url = parseUriList(data.uriList)
    if (url) return { url }
  }

  if (data.html) {
    const fromHtml = parseHtmlAnchor(data.html)
    if (fromHtml) return fromHtml
  }

  if (data.plain) {
    const token = data.plain.trim()
    // 纯文本兜底仅接受“看起来就是单个 URL”的输入，避免把句子当链接。
    if (token && !/\s/.test(token)) {
      const url = isAllowedUrl(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(token) ? token : `https://${token}`)
      if (url) return { url }
    }
  }

  return null
}
