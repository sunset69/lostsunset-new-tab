import { describe, expect, it } from 'vitest'
import { buildSearchUrl } from './url-search'

const BING_TEMPLATE = 'https://www.bing.com/search?q={{query}}'
const GOOGLE_TEMPLATE = 'https://www.google.com/search?q={{query}}'

describe('buildSearchUrl', () => {
  it('按模板生成搜索引擎结果 URL', () => {
    expect(buildSearchUrl(BING_TEMPLATE, 'react 19')).toBe(
      'https://www.bing.com/search?q=react%2019',
    )
    expect(buildSearchUrl(GOOGLE_TEMPLATE, 'mv3')).toBe(
      'https://www.google.com/search?q=mv3',
    )
  })

  it('对中文与特殊字符做编码', () => {
    expect(buildSearchUrl(BING_TEMPLATE, '新标签页 #1')).toBe(
      'https://www.bing.com/search?q=%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5%20%231',
    )
  })

  it('忽略首尾空白', () => {
    expect(buildSearchUrl(BING_TEMPLATE, '  mv3  ')).toBe(
      'https://www.bing.com/search?q=mv3',
    )
  })

  it('空查询或纯空白返回 null', () => {
    expect(buildSearchUrl(BING_TEMPLATE, '')).toBeNull()
    expect(buildSearchUrl(BING_TEMPLATE, '   ')).toBeNull()
  })

  it('模板缺少 {{query}} 占位符返回 null', () => {
    expect(buildSearchUrl('https://www.bing.com/search', 'mv3')).toBeNull()
  })

  it('模板不是合法 URL 时返回 null', () => {
    expect(buildSearchUrl('not-a-url/{{query}}', 'mv3')).toBeNull()
  })

  it('拒绝 http/https 之外的协议', () => {
    expect(buildSearchUrl('javascript:alert(1)//{{query}}', 'mv3')).toBeNull()
    expect(buildSearchUrl('data:text/html,{{query}}', 'mv3')).toBeNull()
  })

  it('允许 http 内网地址', () => {
    expect(buildSearchUrl('http://192.168.1.10:8080/search?q={{query}}', 'log')).toBe(
      'http://192.168.1.10:8080/search?q=log',
    )
  })
})
