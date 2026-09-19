// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfigProvider } from '../../config/config-context'
import BackupSection from './BackupSection'
import { createMemoryStorage } from '../../../shared/storage/memory-storage'
import { STORAGE_KEYS } from '../../../shared/storage/storage-keys'
import { createDefaultConfig } from '../../../shared/config/default-config'
import { createBackup } from '../../../shared/services/backup-service'
import type { UserConfig } from '../../../shared/models/config'
import { installMemoryLocalStorage } from '../../../test/local-storage-shim'

function renderSection(config: UserConfig) {
  const storage = createMemoryStorage({ [STORAGE_KEYS.userConfig]: config })
  const result = render(
    <ConfigProvider storage={storage}>
      <BackupSection />
    </ConfigProvider>,
  )
  return { storage, ...result }
}

function importedConfig(): UserConfig {
  const config = createDefaultConfig(new Date('2026-09-19T00:00:00.000Z'))
  config.settings.searchEngine.name = '导入的引擎'
  config.environments.push({
    id: 'env-office',
    name: '办公',
    variables: { baseUrl: 'http://10.1.1.1' },
  })
  return config
}

describe('BackupSection', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('点击导出时下载 JSON 文件', () => {
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    try {
      renderSection(createDefaultConfig())

      fireEvent.click(screen.getByRole('button', { name: '导出配置' }))

      expect(clickSpy).toHaveBeenCalledTimes(1)
      const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
      expect(anchor.download).toMatch(/^lostsunset-new-tab-backup-\d{4}-\d{2}-\d{2}\.json$/)
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })

  it('导入合法备份：先展示摘要，确认后写入配置并生成本地自动备份', async () => {
    const target = importedConfig()
    const { storage } = renderSection(createDefaultConfig())
    const backupFile = new File([JSON.stringify(createBackup(target))], 'backup.json', {
      type: 'application/json',
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [backupFile] } })

    await waitFor(() => {
      expect(screen.getByText('确认导入以下备份？')).not.toBeNull()
    })
    expect(screen.getByText('导入的引擎')).not.toBeNull()
    expect(screen.getByText('2 个')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))

    await waitFor(() => {
      expect(screen.getByText('配置导入成功，导入前的配置已自动备份。')).not.toBeNull()
    })

    const saved = await storage.get<UserConfig>(STORAGE_KEYS.userConfig)
    expect(saved!.settings.searchEngine.name).toBe('导入的引擎')
    expect(saved!.environments).toHaveLength(2)

    const autoBackup = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.localBackupBeforeImport) ?? 'null',
    ) as { reason: string; config: UserConfig } | null
    expect(autoBackup).not.toBeNull()
    expect(autoBackup!.reason).toBe('manual-import')
    expect(autoBackup!.config.settings.searchEngine.name).toBe('Bing')
  })

  it('非法文件显示错误且不覆盖当前配置', async () => {
    const { storage } = renderSection(createDefaultConfig())
    const badFile = new File(['<<<not json>>>'], 'bad.json', { type: 'application/json' })

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [badFile] },
    })

    await waitFor(() => {
      expect(screen.getByText('文件不是有效的配置备份')).not.toBeNull()
    })
    const saved = await storage.get<UserConfig>(STORAGE_KEYS.userConfig)
    expect(saved!.settings.searchEngine.name).toBe('Bing')
    expect(window.localStorage.getItem(STORAGE_KEYS.localBackupBeforeImport)).toBeNull()
  })

  it('WebDAV 表单为空时上传被拦截并提示，且不发起网络请求', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderSection(createDefaultConfig())

    fireEvent.click(screen.getByRole('button', { name: '上传到 WebDAV' }))

    expect(screen.getByText('请完整填写服务地址、远端路径、用户名和密码')).not.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('填写 HTTP 地址时显示明文传输风险', () => {
    const { container } = renderSection(createDefaultConfig())
    const input = screen.getByLabelText('服务地址') as HTMLInputElement
    fireEvent.change(input, {
      target: { value: 'http://192.168.1.20:5244' },
    })
    expect(input.value).toBe('http://192.168.1.20:5244')
    expect(container.textContent).toContain('HTTP 明文连接')
  })
})
