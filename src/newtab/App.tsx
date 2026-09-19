import { useEffect, useRef, useState } from 'react'
import { useConfig } from './config/config-context'
import { useWallpaper } from './hooks/useWallpaper'
import WallpaperLayer from './components/WallpaperLayer/WallpaperLayer'
import TopBar from './components/TopBar/TopBar'
import ClockGreeting from './components/ClockGreeting/ClockGreeting'
import SearchBar from './components/SearchBar/SearchBar'
import ShortcutDock from './components/ShortcutDock/ShortcutDock'
import ShortcutQuickAdd, {
  type ShortcutQuickAddInitial,
} from './components/ShortcutQuickAdd/ShortcutQuickAdd'
import SettingsDrawer from './components/SettingsDrawer/SettingsDrawer'
import { parseDroppedLink } from '../shared/utils/dnd-link'
import { DEFAULT_GROUP_ID } from '../shared/config/default-config'

export type SettingsSection = 'search' | 'environment' | 'shortcuts' | 'wallpaper' | 'backup'

/** 「+」/拖拽共用的快捷添加弹窗状态；null 表示关闭。 */
type QuickAddState = { initial?: ShortcutQuickAddInitial } | null

export default function App() {
  const { ready, config, recovered, updateConfig } = useConfig()
  const wallpaper = useWallpaper(config ? config.settings.wallpaper : null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('search')
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  function openSettings(section: SettingsSection = 'search') {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  function showToast(text: string) {
    setToast(text)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }

  function handleDragOver(event: React.DragEvent) {
    // 允许 drop；否则浏览器会直接导航到拖入的链接。
    event.preventDefault()
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    // 设置抽屉打开时不响应，避免与抽屉交互冲突。
    if (settingsOpen || !config) return

    const dropped = parseDroppedLink({
      uriList: event.dataTransfer.getData('text/uri-list'),
      html: event.dataTransfer.getData('text/html'),
      plain: event.dataTransfer.getData('text/plain'),
    })
    if (!dropped) {
      showToast('未能识别拖入的链接')
      return
    }
    setQuickAdd({ initial: { url: dropped.url, title: dropped.title } })
  }

  const defaultGroupId =
    [...(config?.shortcutGroups ?? [])].sort((a, b) => a.order - b.order)[0]?.id ?? DEFAULT_GROUP_ID

  return (
    <main className="page" onDragOver={handleDragOver} onDrop={handleDrop}>
      <h1 className="visually-hidden">LostSunset 起始页</h1>
      <WallpaperLayer
        background={wallpaper.background}
        overlayOpacity={config?.settings.wallpaper.overlayOpacity ?? 0.28}
      />

      {!ready || !config ? (
        <p className="visually-hidden" aria-live="polite">
          正在加载配置…
        </p>
      ) : (
        <>
          <TopBar onOpenSettings={() => openSettings('search')} onOpenWallpaper={() => openSettings('wallpaper')} />
          <ClockGreeting />
          {recovered && (
            <p className="page__notice" role="status">
              检测到配置损坏，已恢复为默认配置
            </p>
          )}
          {wallpaper.recovered && (
            <p className="page__notice" role="status">
              原壁纸不存在，已切换默认背景
            </p>
          )}
          <ShortcutDock onRequestAdd={() => setQuickAdd({})}>
            <SearchBar
              engines={config.settings.searchEngines}
              activeEngineId={config.settings.activeSearchEngineId}
              onChangeEngine={(id) => {
                void updateConfig((draft) => {
                  draft.settings.activeSearchEngineId = id
                })
              }}
              onManageEngines={() => openSettings('search')}
            />
          </ShortcutDock>
          {settingsOpen && (
            <SettingsDrawer
              initialSection={settingsSection}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </>
      )}

      {quickAdd && config && (
        <ShortcutQuickAdd
          initial={quickAdd.initial}
          defaultGroupId={defaultGroupId}
          onClose={() => setQuickAdd(null)}
        />
      )}
      {toast && (
        <p className="page__notice" role="status">
          {toast}
        </p>
      )}
    </main>
  )
}
