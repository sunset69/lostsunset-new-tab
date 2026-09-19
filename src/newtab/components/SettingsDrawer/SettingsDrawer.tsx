import { useEffect, useRef, type ReactNode } from 'react'
import SearchEngineSection from './SearchEngineSection'
import EnvironmentSection from './EnvironmentSection'
import ShortcutSection from './ShortcutSection'
import WallpaperSection from './WallpaperSection'
import BackupSection from './BackupSection'
import type { SettingsSection } from '../../App'
import './SettingsDrawer.css'

type SettingsDrawerProps = {
  onClose: () => void
  initialSection?: SettingsSection
}

const SECTION_IDS: Record<SettingsSection, string> = {
  search: 'settings-section-search',
  environment: 'settings-section-environment',
  shortcuts: 'settings-section-shortcuts',
  wallpaper: 'settings-section-wallpaper',
  backup: 'settings-section-backup',
}

function SettingsSectionBlock({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="settings-section" id={id}>
      <h2 className="settings-section__title">{title}</h2>
      {description && <p className="settings-section__desc">{description}</p>}
      {children}
    </section>
  )
}

/** 设置抽屉（设计文档 3.2）：右侧模态面板，Esc / 点击遮罩关闭。 */
export default function SettingsDrawer({
  onClose,
  initialSection = 'search',
}: SettingsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const section = document.getElementById(SECTION_IDS[initialSection])
    const body = bodyRef.current
    if (section && body) {
      body.scrollTop = Math.max(
        0,
        section.getBoundingClientRect().top -
          body.getBoundingClientRect().top +
          body.scrollTop -
          12,
      )
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, initialSection])

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-drawer__header">
          <h1 className="settings-drawer__title" id="settings-title">
            设置
          </h1>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            aria-label="关闭设置"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.4 6.3 6.3-6.3 6.3 1.4 1.4 6.3-6.3 6.3 6.3 1.4-1.4-6.3-6.3 6.3-6.3z"
                fill="currentColor"
              />
            </svg>
          </button>
        </header>

        <div className="settings-drawer__body" ref={bodyRef}>
          <SettingsSectionBlock
            id={SECTION_IDS.search}
            title="搜索引擎"
            description="地址中必须包含 {{query}} 占位符。"
          >
            <SearchEngineSection />
          </SettingsSectionBlock>

          <SettingsSectionBlock
            id={SECTION_IDS.environment}
            title="环境"
            description="为内网地址定义变量（如 baseUrl），快捷方式可用 {{变量名}} 引用。"
          >
            <EnvironmentSection />
          </SettingsSectionBlock>

          <SettingsSectionBlock
            id={SECTION_IDS.shortcuts}
            title="快捷方式"
            description="支持完整 URL 或 {{变量名}} 模板。"
          >
            <ShortcutSection />
          </SettingsSectionBlock>

          <SettingsSectionBlock
            id={SECTION_IDS.wallpaper}
            title="壁纸"
            description="选择渐变或内置壁纸，也可以上传本地图片；拖动滑块调节遮罩保证文字可读。"
          >
            <WallpaperSection />
          </SettingsSectionBlock>

          <SettingsSectionBlock
            id={SECTION_IDS.backup}
            title="备份与同步"
            description="导出/导入 JSON 配置，或通过自行配置的 WebDAV 服务手动上传备份与恢复。"
          >
            <BackupSection />
          </SettingsSectionBlock>
        </div>
      </div>
    </div>
  )
}
