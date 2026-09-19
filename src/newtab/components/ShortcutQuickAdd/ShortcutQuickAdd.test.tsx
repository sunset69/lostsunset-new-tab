// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ShortcutQuickAdd from './ShortcutQuickAdd'
import { ConfigProvider } from '../../config/config-context'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import type { UserConfig } from '../../../shared/models/config'

async function setup(initial?: { url?: string; title?: string }) {
  const onClose = vi.fn()
  const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: createDefaultConfig() })
  render(
    <ConfigProvider storage={storage}>
      <ShortcutQuickAdd initial={initial} defaultGroupId="group-default" onClose={onClose} />
    </ConfigProvider>,
  )
  // 配置异步加载完成后弹窗才渲染。
  await screen.findByRole('dialog', { name: '添加快捷方式' })
  return { onClose, storage }
}

async function readShortcuts(storage: ReturnType<typeof createMemoryStorage>) {
  const config = await storage.get<UserConfig>(STORAGE_KEYS.userConfig)
  return config?.shortcuts ?? []
}

describe('ShortcutQuickAdd 基础交互', () => {
  it('渲染弹窗与表单，焦点落在网址输入框', async () => {
    await setup()
    const dialog = screen.getByRole('dialog', { name: '添加快捷方式' })
    expect(dialog).not.toBeNull()
    expect(screen.getByLabelText('网址')).toBe(document.activeElement)
  })

  it('按 Escape 触发 onClose', async () => {
    const { onClose } = await setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩关闭，点击弹窗内部不关闭', async () => {
    const { onClose } = await setup()
    const dialog = screen.getByRole('dialog', { name: '添加快捷方式' })

    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('拖拽预填网址与标题', async () => {
    await setup({ url: 'https://example.com', title: '示例站' })
    expect((screen.getByLabelText('网址') as HTMLInputElement).value).toBe('https://example.com')
    expect((screen.getByLabelText('名称（留空自动取域名）') as HTMLInputElement).value).toBe('示例站')
  })
})

describe('ShortcutQuickAdd 提交', () => {
  it('缺协议补 https、名称留空自动取域名并入库', async () => {
    const { onClose, storage } = await setup()

    fireEvent.change(screen.getByLabelText('网址'), { target: { value: 'example.com/x' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(async () => {
      expect(await readShortcuts(storage)).toHaveLength(1)
    })
    const [shortcut] = await readShortcuts(storage)
    expect(shortcut.urlTemplate).toBe('https://example.com/x')
    expect(shortcut.title).toBe('example.com')
    expect(shortcut.groupId).toBe('group-default')
    expect(shortcut.icon.type).toBe('favicon')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('非法网址行内报错且不入库', async () => {
    const { onClose, storage } = await setup()

    fireEvent.change(screen.getByLabelText('网址'), { target: { value: 'ht!tp://bad' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('网址格式不正确')
    expect(
      (screen.getByLabelText('网址') as HTMLInputElement).getAttribute('aria-invalid'),
    ).toBe('true')
    expect(onClose).not.toHaveBeenCalled()
    expect(await readShortcuts(storage)).toHaveLength(0)
  })

  it('空网址报错', async () => {
    const { onClose } = await setup()

    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('网址不能为空')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('表情图标缺字符报错，填写后可提交', async () => {
    const { storage } = await setup()

    fireEvent.change(screen.getByLabelText('网址'), { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('图标'), { target: { value: 'emoji' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请填写一个表情字符')

    fireEvent.change(screen.getByLabelText('表情'), { target: { value: '🛠️' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(async () => {
      expect(await readShortcuts(storage)).toHaveLength(1)
    })
    const [shortcut] = await readShortcuts(storage)
    expect(shortcut.icon).toEqual({ type: 'emoji', value: '🛠️' })
  })

  it('选择首字母图标时 icon 类型为 custom', async () => {
    const { storage } = await setup()

    fireEvent.change(screen.getByLabelText('网址'), { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('名称（留空自动取域名）'), {
      target: { value: '示例' },
    })
    fireEvent.change(screen.getByLabelText('图标'), { target: { value: 'initial' } })
    fireEvent.click(screen.getByRole('button', { name: '添加' }))

    await waitFor(async () => {
      expect(await readShortcuts(storage)).toHaveLength(1)
    })
    const [shortcut] = await readShortcuts(storage)
    expect(shortcut.icon.type).toBe('custom')
    expect(shortcut.title).toBe('示例')
  })
})
