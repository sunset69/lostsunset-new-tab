// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SearchBar, { type SearchBarProps } from './SearchBar'
import type { SearchEngine } from '../../../shared/models/config'

const ENGINES: SearchEngine[] = [
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
]

function setup(props?: Partial<SearchBarProps>) {
  const onNavigate = vi.fn()
  const onChangeEngine = vi.fn()
  render(
    <SearchBar
      engines={ENGINES}
      activeEngineId="bing"
      onChangeEngine={onChangeEngine}
      onNavigate={onNavigate}
      {...props}
    />,
  )
  return { onNavigate, onChangeEngine }
}

describe('SearchBar 基础', () => {
  it('渲染可访问的搜索框与提交按钮', () => {
    setup()
    expect(screen.queryByRole('search')).not.toBeNull()
    expect(screen.getByLabelText('搜索关键词')).not.toBeNull()
    expect(screen.getByRole('button', { name: '使用Bing搜索' })).not.toBeNull()
    expect(screen.getByText('Bing')).not.toBeNull()
  })

  it('输入关键词后提交会跳转到搜索引擎结果页', () => {
    const { onNavigate } = setup()
    const input = screen.getByLabelText('搜索关键词')

    fireEvent.change(input, { target: { value: 'react 19' } })
    fireEvent.click(screen.getByRole('button', { name: '使用Bing搜索' }))

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('https://www.bing.com/search?q=react%2019')
  })

  it('空查询提交不跳转', () => {
    const { onNavigate } = setup()
    fireEvent.click(screen.getByRole('button', { name: '使用Bing搜索' }))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('纯空白查询提交不跳转', () => {
    const { onNavigate } = setup()
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('直接触发表单提交也能跳转（等价于回车提交）', () => {
    const { onNavigate } = setup()
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: '新标签页' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(onNavigate).toHaveBeenCalledWith(
      'https://www.bing.com/search?q=%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5',
    )
  })
})

describe('SearchBar 引擎切换', () => {
  it('点击徽标展开引擎列表并可选择', () => {
    const { onChangeEngine } = setup()
    fireEvent.click(screen.getByRole('button', { name: /切换搜索引擎/ }))
    expect(screen.getByRole('listbox', { name: '选择搜索引擎' })).not.toBeNull()

    fireEvent.click(screen.getByRole('option', { name: /百度/ }))
    expect(onChangeEngine).toHaveBeenCalledWith('baidu')
  })

  it('选择引擎后关闭菜单', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /切换搜索引擎/ }))
    fireEvent.click(screen.getByRole('option', { name: /百度/ }))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('SearchBar keyword 空格调用', () => {
  it('输入 keyword+空格 临时切换引擎并清除前缀', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    expect(input().value).toBe('')
    expect(screen.getByText('百度')).not.toBeNull()
    expect(screen.getByPlaceholderText('使用 百度 搜索')).not.toBeNull()
  })

  it('临时引擎提交搜索后恢复默认引擎', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    fireEvent.change(input(), { target: { value: '新标签页' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(screen.getByText('Bing')).not.toBeNull()
    expect(screen.getByPlaceholderText('使用 Bing 搜索')).not.toBeNull()
  })

  it('当前引擎自身的 keyword 不触发切换', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    setup()
    fireEvent.change(input(), { target: { value: 'bing ' } })
    expect(input().value).toBe('bing ')
    expect(screen.getByText('Bing')).not.toBeNull()
  })

  it('输入恰好等于 keyword 时显示提示', () => {
    setup()
    fireEvent.change(screen.getByLabelText('搜索关键词'), { target: { value: 'baidu' } })
    expect(screen.getByText('空格使用 百度 搜索')).not.toBeNull()
  })

  it('临时引擎提交跳转到对应引擎', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    const { onNavigate } = setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    fireEvent.change(input(), { target: { value: '天气' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(onNavigate).toHaveBeenCalledWith('https://www.baidu.com/s?wd=%E5%A4%A9%E6%B0%94')
  })

  it('临时切换后清空输入立即恢复默认引擎（002 问题 1）', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    expect(screen.getByPlaceholderText('使用 百度 搜索')).not.toBeNull()

    // 输入任意内容后再清空：临时引擎必须解除。
    fireEvent.change(input(), { target: { value: 'x' } })
    fireEvent.change(input(), { target: { value: '' } })
    expect(screen.getByText('Bing')).not.toBeNull()
    expect(screen.getByPlaceholderText('使用 Bing 搜索')).not.toBeNull()
  })

  it('临时切换后可用默认引擎 keyword 再切回来（不会锁死）', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    expect(screen.getByPlaceholderText('使用 百度 搜索')).not.toBeNull()

    fireEvent.change(input(), { target: { value: 'bing ' } })
    expect(input().value).toBe('')
    expect(screen.getByText('Bing')).not.toBeNull()
    expect(screen.getByPlaceholderText('使用 Bing 搜索')).not.toBeNull()
  })

  it('临时切换期间徽标给出临时态提示，菜单高亮当前生效引擎', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    expect(screen.getByRole('button', { name: /当前：百度·临时/ })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /切换搜索引擎/ }))
    const baiduOption = screen.getByRole('option', { name: /百度/ })
    expect(baiduOption.getAttribute('aria-selected')).toBe('true')
  })

  it('临时切换后从菜单选择引擎会持久化并解除临时态', () => {
    const input = () => screen.getByLabelText('搜索关键词') as HTMLInputElement
    const { onChangeEngine } = setup()
    fireEvent.change(input(), { target: { value: 'baidu ' } })
    fireEvent.click(screen.getByRole('button', { name: /切换搜索引擎/ }))
    fireEvent.click(screen.getByRole('option', { name: /Bing/ }))
    expect(onChangeEngine).toHaveBeenCalledWith('bing')
    expect(screen.queryByRole('button', { name: /临时/ })).toBeNull()
  })
})
