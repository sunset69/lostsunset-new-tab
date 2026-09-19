// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider } from '../../config/config-context'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import ShortcutDock from './ShortcutDock'

function renderDock() {
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
  const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: config })

  return render(
    <ConfigProvider storage={storage}>
      <ShortcutDock>
        <div>search-slot</div>
      </ShortcutDock>
    </ConfigProvider>,
  )
}

describe('ShortcutDock', () => {
  it('渲染解析后的快捷方式链接与缺变量错误态', async () => {
    renderDock()

    const link = await waitFor(() => screen.getByRole('link', { name: '后台管理' }))
    expect((link as HTMLAnchorElement).href).toBe('http://192.168.1.10:8080/admin')

    // 缺变量的快捷方式不是链接，并暴露错误说明。
    const broken = screen.getByTitle('当前环境缺少所需变量')
    expect(broken.tagName).toBe('SPAN')
    expect(broken.querySelector('a')).toBeNull()
    expect(broken.textContent).toContain('失效服务')
  })

  it('空配置显示添加提示', async () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.userConfig]: createDefaultConfig(),
    })
    render(
      <ConfigProvider storage={storage}>
        <ShortcutDock>
          <div />
        </ShortcutDock>
      </ConfigProvider>,
    )

    await waitFor(() =>
      expect(screen.getByText(/还没有快捷方式/)).not.toBeNull(),
    )
  })
})
