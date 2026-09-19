// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EnvironmentSwitcher from './EnvironmentSwitcher'

const environments = [
  { id: 'env-a', name: '家里', color: '#f59e0b', variables: {} },
  { id: 'env-b', name: '公司', color: '#38bdf8', variables: {} },
]

function setup(activeId = 'env-b', onSelect = vi.fn()) {
  render(<EnvironmentSwitcher environments={environments} activeId={activeId} onSelect={onSelect} />)
  return { onSelect }
}

describe('EnvironmentSwitcher', () => {
  it('渲染当前环境 chip，默认收起', () => {
    setup('env-b')
    const chip = screen.getByRole('button', { name: '当前环境：公司，切换环境' })
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('点击 chip 展开全部环境并标记当前项', () => {
    setup('env-b')
    fireEvent.click(screen.getByRole('button', { name: /当前环境/ }))
    expect(screen.getByRole('listbox', { name: '选择环境' })).not.toBeNull()
    const company = screen.getByRole('option', { name: /公司/ })
    expect(company.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('option', { name: /家里/ }).getAttribute('aria-selected')).toBe('false')
  })

  it('选择环境时回调新 id、关闭菜单并把焦点还给 chip', () => {
    const { onSelect } = setup('env-a')
    fireEvent.click(screen.getByRole('button', { name: /当前环境/ }))
    fireEvent.click(screen.getByRole('option', { name: /公司/ }))
    expect(onSelect).toHaveBeenCalledWith('env-b')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('button', { name: /当前环境/ })).toBe(document.activeElement)
  })

  it('Escape 关闭菜单并回到 chip', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /当前环境/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('button', { name: /当前环境/ })).toBe(document.activeElement)
  })

  it('点击组件外部关闭菜单', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /当前环境/ }))
    expect(screen.getByRole('listbox')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('键盘：ArrowDown 打开并聚焦当前项，再按方向键移动，Enter 选中', () => {
    const { onSelect } = setup('env-a')
    const chip = screen.getByRole('button', { name: /当前环境/ })
    chip.focus()
    fireEvent.keyDown(chip, { key: 'ArrowDown' })

    const home = screen.getByRole('option', { name: /家里/ })
    expect(home).toBe(document.activeElement)

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /公司/ })).toBe(document.activeElement)

    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('env-b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
