// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ClockGreeting from './ClockGreeting'

afterEach(() => {
  vi.useRealTimers()
})

describe('ClockGreeting', () => {
  it('中午时段渲染时钟、日期与问候语', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 12, 0) })
    render(<ClockGreeting />)

    const region = screen.getByRole('region', { name: '当前时间 12:00' })
    const time = screen.getByText('12:00')
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe(new Date(2026, 8, 19, 12, 0).toISOString())
    expect(region.textContent).toContain('9月19日 星期六 · 中午好')
  })

  it('夜间时段显示晚上好', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 21, 30) })
    render(<ClockGreeting />)

    expect(screen.getByText('21:30')).not.toBeNull()
    expect(screen.getByText(/晚上好/)).not.toBeNull()
  })
})
