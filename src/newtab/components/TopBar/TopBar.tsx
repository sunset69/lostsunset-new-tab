import { useConfig } from '../../config/config-context'
import EnvironmentSwitcher from '../EnvironmentSwitcher/EnvironmentSwitcher'
import './TopBar.css'

type TopBarProps = {
  onOpenSettings: () => void
  onOpenWallpaper: () => void
}

/** 顶栏（设计文档 3.2）：环境切换 + 壁纸快捷入口 + 设置入口。 */
export default function TopBar({ onOpenSettings, onOpenWallpaper }: TopBarProps) {
  const { config, updateConfig } = useConfig()

  if (!config) {
    return null
  }

  return (
    <header className="topbar">
      <EnvironmentSwitcher
        environments={config.environments}
        activeId={config.settings.activeEnvironmentId}
        onSelect={(environmentId) =>
          updateConfig((draft) => {
            draft.settings.activeEnvironmentId = environmentId
          })
        }
      />
      <div className="topbar__actions">
        <button
          type="button"
          className="topbar__icon-button"
          aria-label="更换壁纸"
          title="更换壁纸"
          onClick={onOpenWallpaper}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          type="button"
          className="topbar__icon-button"
          aria-label="打开设置"
          title="设置"
          onClick={onOpenSettings}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path
              d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
