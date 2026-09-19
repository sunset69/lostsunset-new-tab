// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider } from '../../config/config-context'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import ShortcutDock from './ShortcutDock'
import type { Shortcut, UserConfig } from '../../../shared/models/config'

function renderDock(config: UserConfig = createDefaultConfig()) {
  const onRequestAdd = vi.fn()
  const onRequestEditShortcut = vi.fn()
  const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: config })
  render(
    <ConfigProvider storage={storage}>
      <ShortcutDock onRequestAdd={onRequestAdd} onRequestEditShortcut={onRequestEditShortcut}>
        <div>search-slot</div>
      </ShortcutDock>
    </ConfigProvider>,
  )
  return { onRequestAdd, onRequestEditShortcut, storage }
}

async function readConfig(storage: ReturnType<typeof createMemoryStorage>) {
  return (await storage.get<UserConfig>(STORAGE_KEYS.userConfig))!
}

function makeShortcut(overrides: Partial<Shortcut> = {}): Shortcut {
  return {
    id: 's1',
    groupId: 'group-default',
    title: '示例站',
    urlTemplate: 'https://example.com',
    icon: { type: 'favicon', value: '' },
    order: 0,
    ...overrides,
  }
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

describe('ShortcutDock 右键菜单（0003 改善 1/2）', () => {
  it('右键快捷方式弹出菜单，「编辑」回调携带该快捷方式', async () => {
    const config = createDefaultConfig()
    config.shortcuts = [makeShortcut()]
    const { onRequestEditShortcut } = renderDock(config)

    const link = await screen.findByRole('link', { name: '示例站' })
    fireEvent.contextMenu(link)

    const menu = screen.getByRole('menu', { name: '快捷操作' })
    expect(menu.textContent).toContain('编辑')
    fireEvent.click(screen.getByRole('menuitem', { name: '编辑' }))

    expect(onRequestEditShortcut).toHaveBeenCalledTimes(1)
    expect(onRequestEditShortcut.mock.calls[0][0].id).toBe('s1')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('删除需两步确认，确认后快捷方式移除并重排 order', async () => {
    const config = createDefaultConfig()
    config.shortcuts = [
      makeShortcut({ id: 's1', title: '第一站', order: 0 }),
      makeShortcut({ id: 's2', title: '第二站', urlTemplate: 'https://b.example.com', order: 1 }),
    ]
    const { storage } = renderDock(config)

    fireEvent.contextMenu(await screen.findByRole('link', { name: '第一站' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
    // 第一步只确认，菜单保持打开、未删除。
    expect(screen.getByRole('menuitem', { name: '确认删除？' })).not.toBeNull()
    expect((await readConfig(storage)).shortcuts).toHaveLength(2)

    fireEvent.click(screen.getByRole('menuitem', { name: '确认删除？' }))
    await waitFor(async () => {
      expect((await readConfig(storage)).shortcuts).toHaveLength(1)
    })
    const shortcuts = (await readConfig(storage)).shortcuts
    expect(shortcuts[0].id).toBe('s2')
    expect(shortcuts[0].order).toBe(0)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('右键分组可重命名（内联输入 Enter 确认）', async () => {
    const config = createDefaultConfig()
    config.shortcutGroups = [
      { id: 'group-default', name: '常用网站', order: 0 },
      { id: 'group-work', name: '工作', order: 1 },
    ]
    const { storage } = renderDock(config)

    fireEvent.contextMenu(await screen.findByRole('button', { name: '工作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))

    const input = screen.getByLabelText('重命名分组 工作') as HTMLInputElement
    expect(input.value).toBe('工作')
    fireEvent.change(input, { target: { value: '工作日' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(async () => {
      const groups = (await readConfig(storage)).shortcutGroups
      expect(groups.find((group) => group.id === 'group-work')?.name).toBe('工作日')
    })
    expect(screen.getByRole('button', { name: '工作日' })).not.toBeNull()
  })

  it('重命名输入为空时回退原名', async () => {
    const config = createDefaultConfig()
    config.shortcutGroups = [
      { id: 'group-default', name: '常用网站', order: 0 },
      { id: 'group-work', name: '工作', order: 1 },
    ]
    const { storage } = renderDock(config)

    fireEvent.contextMenu(await screen.findByRole('button', { name: '工作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    const input = screen.getByLabelText('重命名分组 工作') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    const groups = (await readConfig(storage)).shortcutGroups
    expect(groups.find((group) => group.id === 'group-work')?.name).toBe('工作')
  })

  it('删除分组需两步确认，组内快捷方式移入剩余第一个分组', async () => {
    const config = createDefaultConfig()
    config.shortcutGroups = [
      { id: 'group-default', name: '常用网站', order: 0 },
      { id: 'group-work', name: '工作', order: 1 },
    ]
    config.shortcuts = [makeShortcut({ id: 's1', groupId: 'group-work' })]
    const { storage } = renderDock(config)

    fireEvent.contextMenu(await screen.findByRole('button', { name: '工作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
    expect(screen.getByRole('menuitem', { name: '确认删除？' })).not.toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: '确认删除？' }))
    await waitFor(async () => {
      expect((await readConfig(storage)).shortcutGroups).toHaveLength(1)
    })
    const next = await readConfig(storage)
    expect(next.shortcuts[0].groupId).toBe('group-default')
    // tab 条只剩「全部」+默认组，被删组筛选自动失效。
    expect(screen.queryByRole('button', { name: '工作' })).toBeNull()
  })

  it('菜单打开后点击外部关闭', async () => {
    const config = createDefaultConfig()
    config.shortcuts = [makeShortcut()]
    renderDock(config)

    fireEvent.contextMenu(await screen.findByRole('link', { name: '示例站' }))
    expect(screen.getByRole('menu', { name: '快捷操作' })).not.toBeNull()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('ShortcutDock 宽度调节（0003 改善 3）', () => {
  it('配置手动宽度时 Dock 内联宽度居中渲染', async () => {
    const config = createDefaultConfig()
    config.settings.dock.width = 640
    renderDock(config)

    const dock = (await screen
      .findByText('search-slot')
      .then((el) => el.closest('.shortcut-dock')!)) as HTMLElement
    expect(dock.style.width).toBe('640px')
    expect(dock.style.transform).toBe('translateX(-50%)')
  })

  it('双击把手恢复自动宽度', async () => {
    const config = createDefaultConfig()
    config.settings.dock.width = 640
    const { storage } = renderDock(config)

    const dock = (await screen
      .findByText('search-slot')
      .then((el) => el.closest('.shortcut-dock')!)) as HTMLElement
    fireEvent.doubleClick(dock.querySelector('.shortcut-dock__handle--right')!)

    await waitFor(async () => {
      expect((await readConfig(storage)).settings.dock.width).toBeUndefined()
    })
    expect(dock.style.width).toBe('')
  })

  it('把手方向键按步调整并落盘', async () => {
    const config = createDefaultConfig()
    config.settings.dock.width = 640
    const { storage } = renderDock(config)

    const dock = await screen.findByText('search-slot').then((el) => el.closest('.shortcut-dock')!)
    const handle = dock.querySelector('.shortcut-dock__handle--left')!
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })

    // jsdom 中 getBoundingClientRect 为 0，按 320 下限钳制；真实浏览器按当前宽度 ±16。
    await waitFor(async () => {
      expect((await readConfig(storage)).settings.dock.width).toBe(320)
    })
  })
})
