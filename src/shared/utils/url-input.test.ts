import { describe, expect, it } from 'vitest'
import { defaultTitleFromUrl, normalizeUrlInput } from './url-input'

describe('normalizeUrlInput', () => {
  it('缺协议时补 https://', () => {
    expect(normalizeUrlInput('example.com/admin')).toEqual({
      url: 'https://example.com/admin',
    })
  })

  it('trim 空白并保留 http', () => {
    expect(normalizeUrlInput('  http://192.168.1.10:8080/admin  ')).toEqual({
      url: 'http://192.168.1.10:8080/admin',
    })
  })

  it('空输入报错', () => {
    expect(normalizeUrlInput('  ')).toEqual({ error: '网址不能为空' })
  })

  it('非 http(s) 协议拒绝', () => {
    expect(normalizeUrlInput('javascript:alert(1)')).toEqual({ error: '仅支持 http 或 https 地址' })
    expect(normalizeUrlInput('ftp://example.com')).toEqual({ error: '仅支持 http 或 https 地址' })
  })

  it('非法网址报错', () => {
    expect(normalizeUrlInput('ht!tp://bad')).toEqual({ error: '网址格式不正确' })
  })
})

describe('defaultTitleFromUrl', () => {
  it('取 hostname 并去掉 www 前缀', () => {
    expect(defaultTitleFromUrl('https://www.example.com/path')).toBe('example.com')
    expect(defaultTitleFromUrl('http://192.168.1.10:8080')).toBe('192.168.1.10')
  })

  it('非法输入返回空串', () => {
    expect(defaultTitleFromUrl('not a url')).toBe('')
  })
})
