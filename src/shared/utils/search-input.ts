/**
 * 搜索输入的关键词引擎匹配（0001 改善 5 设计 3.2）。
 * 纯函数：输入「keyword + 单个空格」时返回命中的引擎与剩余输入。
 */

import type { SearchEngine } from '../models/config'

export type KeywordMatch<TEngine extends SearchEngine = SearchEngine> = {
  engine: TEngine
  /** 去掉「keyword+空格」前缀后的剩余输入。 */
  rest: string
}

/**
 * 在已输入文本中检测关键词触发。
 * 仅当输入形如 `${keyword} `（大小写不敏感、以单个空格结尾）时命中；
 * 多引擎同 keyword 时取列表靠前者。
 */
export function matchEngineKeyword<TEngine extends SearchEngine>(
  input: string,
  engines: TEngine[],
): KeywordMatch<TEngine> | null {
  if (!input.endsWith(' ') || input.trimEnd().length === 0) {
    return null
  }

  // 仅允许「keyword + 一个空格」的形式：去掉结尾空格后不能再包含空白。
  const token = input.slice(0, -1)
  if (/\s/.test(token)) {
    return null
  }

  for (const engine of engines) {
    const keyword = engine.keyword?.trim().toLowerCase()
    if (keyword && token.toLowerCase() === keyword) {
      return { engine, rest: '' }
    }
  }
  return null
}

/**
 * 输入恰好等于某引擎 keyword（未加空格）时的提示候选。
 * 返回列表中第一个命中者；用于「空格使用 X 搜索」提示。
 */
export function findKeywordHint<TEngine extends SearchEngine>(
  input: string,
  engines: TEngine[],
): TEngine | null {
  const token = input.trim()
  if (!token || /\s/.test(token)) {
    return null
  }
  for (const engine of engines) {
    const keyword = engine.keyword?.trim().toLowerCase()
    if (keyword && token.toLowerCase() === keyword) {
      return engine
    }
  }
  return null
}
