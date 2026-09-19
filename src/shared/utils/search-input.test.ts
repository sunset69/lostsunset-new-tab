import { describe, expect, it } from 'vitest'
import type { SearchEngine } from '../models/config'
import { findKeywordHint, matchEngineKeyword } from './search-input'

const engines: SearchEngine[] = [
  {
    id: 'bing',
    name: 'Bing',
    searchUrlTemplate: 'https://www.bing.com/search?q={{query}}',
    keyword: 'bing',
  },
  {
    id: 'baidu',
    name: '百度',
    searchUrlTemplate: 'https://www.baidu.com/s?wd={{query}}',
    keyword: 'baidu',
  },
  {
    id: 'nokey',
    name: '无关键词',
    searchUrlTemplate: 'https://s.example.com/?q={{query}}',
  },
]

describe('matchEngineKeyword', () => {
  it('keyword + 单空格触发', () => {
    const match = matchEngineKeyword('baidu ', engines)
    expect(match?.engine.id).toBe('baidu')
    expect(match?.rest).toBe('')
  })

  it('大小写不敏感', () => {
    expect(matchEngineKeyword('Baidu ', engines)?.engine.id).toBe('baidu')
    expect(matchEngineKeyword('BING ', engines)?.engine.id).toBe('bing')
  })

  it('无空格结尾不触发', () => {
    expect(matchEngineKeyword('baidu', engines)).toBeNull()
  })

  it('空格后已有内容不触发', () => {
    expect(matchEngineKeyword('baidu 你好', engines)).toBeNull()
  })

  it('token 中间含空白不触发', () => {
    expect(matchEngineKeyword('bai du ', engines)).toBeNull()
  })

  it('纯空格输入不触发', () => {
    expect(matchEngineKeyword('  ', engines)).toBeNull()
  })

  it('未命中任何 keyword 返回 null', () => {
    expect(matchEngineKeyword('github ', engines)).toBeNull()
  })

  it('无 keyword 的引擎不参与匹配', () => {
    expect(matchEngineKeyword('nokey ', engines)).toBeNull()
  })

  it('同 keyword 取列表靠前者', () => {
    const duplicated: SearchEngine[] = [
      { ...engines[0], id: 'first' },
      { ...engines[0], id: 'second' },
    ]
    expect(matchEngineKeyword('bing ', duplicated)?.engine.id).toBe('first')
  })
})

describe('findKeywordHint', () => {
  it('输入恰好等于 keyword 时返回引擎', () => {
    expect(findKeywordHint('baidu', engines)?.id).toBe('baidu')
    expect(findKeywordHint('Baidu', engines)?.id).toBe('baidu')
  })

  it('多词或空输入不提示', () => {
    expect(findKeywordHint('baidu 你好', engines)).toBeNull()
    expect(findKeywordHint('', engines)).toBeNull()
    expect(findKeywordHint(' ', engines)).toBeNull()
  })

  it('未命中返回 null', () => {
    expect(findKeywordHint('nothing', engines)).toBeNull()
  })
})
