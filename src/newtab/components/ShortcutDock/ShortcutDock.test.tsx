// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider } from '../../config/config-context'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import ShortcutDock from './ShortcutDock'
import type { UserConfig } from '../../../shared/models/config'

function renderDock(config: UserConfig = createDefaultConfig()) {
  const onRequestAdd = vi.fn()
  const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: config })
  render(
    <ConfigProvider storage={storage}>
      <ShortcutDock onRequestAdd={onRequestAdd}>
        <div>search-slot</div>
      </ShortcutDock>
    </ConfigProvider>,
  )
  return { onRequestAdd, storage }
}

describe('ShortcutDock', () => {
  it('渲染解析后的快捷方式链接与缺变量错误态', async () => {
    const config = createDefaultConfig()
    config.environments = [
      {
        id: 'env-default',
        name: '默认环境',
        variables: { baseUrl: 'http://192.168.1.10:8080' },
      },
    ]
    config.shortcuts = [
      {
        id: 's1',
        groupId: 'group-default',
        title: '后台管理',
        urlTemplate: '{{baseUrl}}/admin',
        icon: { type: 'favicon', value: '' },
        order: 1,
      },
      {
        id: 's2',
        groupId: 'group-default',
        title: '失效服务',
        urlTemplate: '{{missingHost}}/x',
        icon: { type: 'emoji', value: '🛠️' },
        order: 0,
      },
    ]
    renderDock(config)

    const link = await waitFor(() => screen.getByRole('link', { name: '后台管理' }))
    expect((link as HTMLAnchorElement).href).toBe('http://192.168.1.10:8080/admin')

    // 缺变量的快捷方式不是链接，并暴露错误说明。
    const broken = screen.getByTitle('当前环境缺少所需变量')
    expect(broken.tagName).toBe('SPAN')
    expect(broken.querySelector('a')).toBeNull()
    expect(broken.textContent).toContain('失效服务')
  })

  it('空配置显示添加提示', async () => {
    renderDock()

    await waitFor(() => expect(screen.getByText(/还没有快捷方式/)).not.toBeNull())
  })

  it('尾部「+」按钮点击触发 onRequestAdd', async () => {
    const { onRequestAdd } = renderDock()
    const add = await screen.findByRole('button', { name: '添加快捷方式' })
    fireEvent.click(add)
    expect(onRequestAdd).toHaveBeenCalledTimes(1)
  })

  it('单分组时不显示分组筛选', async () => {
    renderDock()
    await screen.findByRole('button', { name: '添加快捷方式' })
    expect(screen.queryByRole('toolbar', { name: '快捷方式分组筛选' })).toBeNull()
  })

  it('多分组时显示筛选并可切换过滤', async () => {
    const config = createDefaultConfig()
    config.shortcutGroups = [
      { id: 'group-default', name: '常用网站', order: 0 },
      { id: 'group-work', name: '工作', order: 1 },
    ]
    config.shortcuts = [
      {
        id: 's1',
        groupId: 'group-default',
        title: '后台管理',
        urlTemplate: 'http://a.example.com',
        icon: { type: 'favicon', value: '' },
        order: 0,
      },
      {
        id: 's2',
        groupId: 'group-work',
        title: '工作台',
        urlTemplate: 'http://b.example.com',
        icon: { type: 'emoji', value: '🛠️' },
        order: 1,
      },
    ]
    renderDock(config)

    const toolbar = await screen.findByRole('toolbar', { name: '快捷方式分组筛选' })
    expect(toolbar.textContent).toContain('全部')

    // 选中「工作」分组：只剩该分组的快捷方式。
    fireEvent.click(screen.getByRole('button', { name: '工作' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: '后台管理' })).toBeNull())
    expect(screen.getByRole('link', { name: '工作台' })).not.toBeNull()

    // 回到「全部」。
    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    await waitFor(() => expect(screen.getByRole('link', { name: '后台管理' })).not.toBeNull())
    expect(screen.getByRole('link', { name: '工作台' })).not.toBeNull()
  })

  it('选中空分组显示专属空态且保留「+」', async () => {
    const config = createDefaultConfig()
    config.shortcutGroups = [
      { id: 'group-default', name: '常用网站', order: 0 },
      { id: 'group-empty', name: '空白分组', order: 1 },
    ]
    config.shortcuts = [
      {
        id: 's1',
        groupId: 'group-default',
        title: '后台管理',
        urlTemplate: 'http://a.example.com',
        icon: { type: 'favicon', value: '' },
        order: 0,
      },
    ]
    renderDock(config)

    fireEvent.click(await screen.findByRole('button', { name: '空白分组' }))
    expect(await screen.findByText('该分组还没有快捷方式')).not.toBeNull()
    expect(screen.queryByRole('link', { name: '后台管理' })).toBeNull()
    expect(screen.getByRole('button', { name: '添加快捷方式' })).not.toBeNull()
  })
})
