// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ClockGreeting from './ClockGreeting'
import { ConfigProvider } from '../../config/config-context'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import type { ClockPosition, UserConfig } from '../../../shared/models/config'

function renderClock(config?: UserConfig) {
  const storage = createMemoryStorage({
    [STORAGE_KEYS.userConfig]: config ?? createDefaultConfig(),
  })
  return render(
    <ConfigProvider storage={storage}>
      <ClockGreeting />
    </ConfigProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ClockGreeting', () => {
  it('中午时段渲染时钟、日期与问候语', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 12, 0) })
    renderClock()

    const region = screen.getByRole('region', { name: '当前时间 12:00' })
    const time = screen.getByText('12:00')
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe(new Date(2026, 8, 19, 12, 0).toISOString())
    expect(region.textContent).toContain('9月19日 星期六 · 中午好')
  })

  it('夜间时段显示晚上好', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 19, 21, 30) })
    renderClock()

    expect(screen.getByText('21:30')).not.toBeNull()
    expect(screen.getByText(/晚上好/)).not.toBeNull()
  })

  it('默认（含旧配置缺省 clock）使用左下位置类', () => {
    const config = createDefaultConfig()
    delete config.settings.clock
    const { container } = renderClock(config)

    // 配置加载前先以缺省位置渲染，加载完成后仍为左下。
    expect(container.querySelector('.clock-block--bottom-left')).not.toBeNull()
  })

  it.each([
    'top-right',
    'top-center',
    'middle-center',
    'bottom-right',
  ])('应用配置的时钟位置：%s', async (position) => {
    const config = createDefaultConfig()
    config.settings.clock = { position: position as ClockPosition }
    const { container } = renderClock(config)

    await waitFor(() => {
      expect(container.querySelector(`.clock-block--${position}`)).not.toBeNull()
    })
  })
})
