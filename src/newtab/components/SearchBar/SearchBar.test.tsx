// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SearchBar, { type SearchBarProps } from './SearchBar'
import type { SearchEngine } from '../../../shared/models/config'

const ENGINE: SearchEngine = {
  id: 'bing',
  name: 'Bing',
  searchUrlTemplate: 'https://www.bing.com/search?q={{query}}',
}

function setup(props?: Partial<SearchBarProps>) {
  const onNavigate = vi.fn()
  render(<SearchBar engine={ENGINE} onNavigate={onNavigate} {...props} />)
  return { onNavigate }
}

describe('SearchBar', () => {
  it('渲染可访问的搜索框与提交按钮', () => {
    setup()
    expect(screen.queryByRole('search')).not.toBeNull()
    expect(screen.getByLabelText('搜索关键词')).not.toBeNull()
    expect(screen.getByRole('button', { name: '使用Bing搜索' })).not.toBeNull()
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
