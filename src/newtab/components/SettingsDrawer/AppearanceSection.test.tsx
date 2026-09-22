// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useContext } from 'react'
import AppearanceSection from './AppearanceSection'
import { ConfigContext, ConfigProvider } from '../../config/config-context'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import type { UserConfig } from '../../../shared/models/config'

/** 复现 App / SettingsDrawer 的 ready 门控：配置异步加载完成前不挂载分区。 */
function SectionHarness() {
  const ctx = useContext(ConfigContext)
  return ctx?.ready ? <AppearanceSection /> : null
}

function renderSection(config: UserConfig = createDefaultConfig()) {
  const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: config })
  render(
    <ConfigProvider storage={storage}>
      <SectionHarness />
    </ConfigProvider>,
  )
  return { storage }
}

async function readConfig(storage: ReturnType<typeof createMemoryStorage>) {
  return (await storage.get<UserConfig>(STORAGE_KEYS.userConfig))!
}

describe('AppearanceSection 时钟位置', () => {
  it('渲染九宫格九个选项，默认选中左下', async () => {
    renderSection()
    const group = await screen.findByRole('radiogroup', { name: '时钟位置' })
    const radios = group.querySelectorAll('[role="radio"]')
    expect(radios).toHaveLength(9)

    const bottomLeft = screen.getByRole('radio', { name: '时钟位置：左下' })
    expect(bottomLeft.getAttribute('aria-checked')).toBe('true')
    expect(
      screen.getByRole('radio', { name: '时钟位置：右上' }).getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('旧配置缺少 clock 时回退选中左下', async () => {
    const config = createDefaultConfig()
    delete config.settings.clock
    renderSection(config)

    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: '时钟位置：左下' }).getAttribute('aria-checked'),
      ).toBe('true'),
    )
  })

  it('点击右上后写入配置并更新选中态', async () => {
    const { storage } = renderSection()
    const topRight = await screen.findByRole('radio', { name: '时钟位置：右上' })
    fireEvent.click(topRight)

    await waitFor(async () => {
      const config = await readConfig(storage)
      expect(config.settings.clock).toEqual({ position: 'top-right' })
    })
    expect(topRight.getAttribute('aria-checked')).toBe('true')
    expect(
      screen.getByRole('radio', { name: '时钟位置：左下' }).getAttribute('aria-checked'),
    ).toBe('false')
  })
})
