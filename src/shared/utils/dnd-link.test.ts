import { describe, expect, it } from 'vitest'
import { parseDroppedLink } from './dnd-link'

describe('parseDroppedLink', () => {
  it('优先解析 text/uri-list（跳过注释行）', () => {
    expect(
      parseDroppedLink({
        uriList: '# comment\r\nhttps://example.com/page\r\nhttp://other.example',
      }),
    ).toEqual({ url: 'https://example.com/page' })
  })

  it('uri-list 存在但全部非法时继续尝试 html', () => {
    expect(
      parseDroppedLink({
        uriList: 'javascript:alert(1)',
        html: '<a href="https://example.com">示例</a>',
      }),
    ).toEqual({ url: 'https://example.com', title: '示例' })
  })

  it('从 html 锚点提取 URL 与锚文本', () => {
    expect(
      parseDroppedLink({ html: '<A HREF="https://example.com/a">你好 <b>世界</b></A>' }),
    ).toEqual({ url: 'https://example.com/a', title: '你好 世界' })
  })

  it('html 中使用 title 标签兜底标题', () => {
    expect(
      parseDroppedLink({
        html: '<html><head><title>页面标题</title></head><body><a href="https://example.com"></a></body></html>',
      }),
    ).toEqual({ url: 'https://example.com', title: '页面标题' })
  })

  it('plain 单个 URL 兜底并补协议', () => {
    expect(parseDroppedLink({ plain: 'example.com/x' })).toEqual({
      url: 'https://example.com/x',
    })
  })

  it('plain 含空白则不当作链接', () => {
    expect(parseDroppedLink({ plain: '看看这个 https://example.com' })).toBeNull()
  })

  it('非 http(s) 协议一律拒绝', () => {
    expect(parseDroppedLink({ plain: 'javascript:alert(1)' })).toBeNull()
    expect(parseDroppedLink({ html: '<a href="file:///C:/x">x</a>' })).toBeNull()
  })

  it('全部缺失或非法返回 null', () => {
    expect(parseDroppedLink({})).toBeNull()
    expect(parseDroppedLink({ uriList: '#', html: '<p>no link</p>', plain: '' })).toBeNull()
  })
})
