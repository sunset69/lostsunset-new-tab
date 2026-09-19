// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import EnvironmentSwitcher from './EnvironmentSwitcher'

const environments = [
  { id: 'env-a', name: '家里', color: '#f59e0b', variables: {} },
  { id: 'env-b', name: '公司', color: '#38bdf8', variables: {} },
]

describe('EnvironmentSwitcher', () => {
  it('渲染全部环境并标记当前选项', () => {
    render(<EnvironmentSwitcher environments={environments} activeId="env-b" onSelect={() => {}} />)

    const select = screen.getByLabelText('当前环境')
    expect(select).not.toBeNull()
    expect((select as HTMLSelectElement).value).toBe('env-b')
    expect(screen.getByRole('option', { name: '家里' })).not.toBeNull()
    expect(screen.getByRole('option', { name: '公司' })).not.toBeNull()
  })

  it('切换选项时回调新环境 id', () => {
    const onSelect = vi.fn()
    render(<EnvironmentSwitcher environments={environments} activeId="env-a" onSelect={onSelect} />)

    fireEvent.change(screen.getByLabelText('当前环境'), { target: { value: 'env-b' } })
    expect(onSelect).toHaveBeenCalledWith('env-b')
  })
})
