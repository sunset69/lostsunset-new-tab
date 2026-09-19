// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useContext } from 'react'
import { ConfigContext, ConfigProvider } from '../../config/config-context'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import { createDefaultConfig } from '../../../shared/config/default-config'
import SettingsDrawer from './SettingsDrawer'
import { installMemoryLocalStorage } from '../../../test/local-storage-shim'

/** 复现 App 层的 ready 门控：配置异步加载完成前不挂载抽屉。 */
function DrawerHarness({ onClose }: { onClose: () => void }) {
  const ctx = useContext(ConfigContext)
  return ctx?.ready ? <SettingsDrawer onClose={onClose} /> : null
}

function renderDrawer(onClose = vi.fn()) {
  const storage = createMemoryStorage({
    [STORAGE_KEYS.userConfig]: createDefaultConfig(),
  })
  const result = render(
    <ConfigProvider storage={storage}>
      <DrawerHarness onClose={onClose} />
    </ConfigProvider>,
  )
  return { storage, onClose, ...result }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SettingsDrawer', () => {
  beforeEach(() => {
    // 抽屉内 BackupSection 直接经 localStorage 回填 WebDAV 配置。
    installMemoryLocalStorage()
  })

  it('渲染全部五个设置分区', async () => {
    renderDrawer()
    const dialog = await screen.findByRole('dialog', { name: '设置' })
    for (const title of ['搜索引擎', '环境', '快捷方式', '壁纸', '备份与同步']) {
      expect(within(dialog).getByRole('heading', { name: title })).not.toBeNull()
    }
    // 各分区内容挂载（引擎列表行、WebDAV 操作按钮）。
    expect(within(dialog).getByText('Bing')).not.toBeNull()
    expect(within(dialog).getByRole('button', { name: '测试连接' })).not.toBeNull()
  })

  it('关闭按钮触发 onClose', async () => {
    const { onClose } = renderDrawer()
    const close = await screen.findByRole('button', { name: '关闭设置' })
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('按 Esc 触发 onClose', async () => {
    const { onClose } = renderDrawer()
    await screen.findByRole('dialog', { name: '设置' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩关闭，点击面板内部不关闭', async () => {
    const { onClose } = renderDrawer()
    const dialog = await screen.findByRole('dialog', { name: '设置' })

    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('挂载后焦点落在关闭按钮上', async () => {
    renderDrawer()
    const close = await screen.findByRole('button', { name: '关闭设置' })
    expect(close).toBe(document.activeElement)
  })
})
