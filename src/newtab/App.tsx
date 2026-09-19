import { useState } from 'react'
import { useConfig } from './config/config-context'
import { useWallpaper } from './hooks/useWallpaper'
import WallpaperLayer from './components/WallpaperLayer/WallpaperLayer'
import TopBar from './components/TopBar/TopBar'
import ClockGreeting from './components/ClockGreeting/ClockGreeting'
import SearchBar from './components/SearchBar/SearchBar'
import ShortcutDock from './components/ShortcutDock/ShortcutDock'
import SettingsDrawer from './components/SettingsDrawer/SettingsDrawer'

export type SettingsSection = 'search' | 'environment' | 'shortcuts' | 'wallpaper' | 'backup'

export default function App() {
  const { ready, config, recovered } = useConfig()
  const wallpaper = useWallpaper(config ? config.settings.wallpaper : null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('search')

  function openSettings(section: SettingsSection = 'search') {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  return (
    <main className="page">
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
          <ShortcutDock>
            <SearchBar engine={config.settings.searchEngine} />
          </ShortcutDock>
          {settingsOpen && (
            <SettingsDrawer
              initialSection={settingsSection}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </>
      )}
    </main>
  )
}
