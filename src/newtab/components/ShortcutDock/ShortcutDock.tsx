import { useRef, useState, type ReactNode } from 'react'
import { useConfig } from '../../config/config-context'
import type { Shortcut } from '../../../shared/models/config'
import {
  RESOLVE_ERROR_MESSAGES,
  type ResolveErrorCode,
  resolveShortcutUrl,
} from '../../../shared/services/environment-resolver'
import DockContextMenu, { type DockMenuItem } from '../DockContextMenu/DockContextMenu'
import './ShortcutDock.css'

export type ShortcutDockProps = {
  children: ReactNode
  /** 点击「+」请求打开快捷添加弹窗（弹窗由 App 持有，供拖拽预填复用）。 */
  onRequestAdd: () => void
  /** 右键菜单「编辑」请求打开编辑弹窗（0003 改善 1）。 */
  onRequestEditShortcut: (shortcut: Shortcut) => void
}

/** 取最终 URL 同源的 /favicon.ico，避免把内网域名泄露给第三方图标服务。 */
function getFaviconUrl(resolvedUrl: string): string | null {
  try {
    return new URL('/favicon.ico', resolvedUrl).href
  } catch {
    return null
  }
}

/** Dock 宽度拖拽的下限与视口留白（0003 改善 3）。 */
const DOCK_MIN_WIDTH = 320
const DOCK_VIEWPORT_MARGIN = 24

type DockMenu =
  | { kind: 'shortcut'; shortcutId: string; x: number; y: number }
  | { kind: 'group'; groupId: string; x: number; y: number }

function ShortcutIcon({ shortcut, resolvedUrl }: { shortcut: Shortcut; resolvedUrl: string }) {
  const [fallback, setFallback] = useState(false)
  const faviconUrl = getFaviconUrl(resolvedUrl)

  if (shortcut.icon.type === 'emoji' && shortcut.icon.value) {
    return (
      <span className="shortcut-dock__icon shortcut-dock__icon--emoji" aria-hidden="true">
        {shortcut.icon.value}
      </span>
    )
  }

  // 自定义图片 URL（0004 改善 2）：加载失败（含协议受限/断链）回退名称首字。
  if (shortcut.icon.type === 'image' && shortcut.icon.value && !fallback) {
    return (
      <img
        className="shortcut-dock__icon shortcut-dock__icon--img"
        src={shortcut.icon.value}
        alt=""
        aria-hidden="true"
        onError={() => setFallback(true)}
      />
    )
  }

  if (shortcut.icon.type === 'favicon' && faviconUrl && !fallback) {
    return (
      <img
        className="shortcut-dock__icon shortcut-dock__icon--img"
        src={faviconUrl}
        alt=""
        aria-hidden="true"
        onError={() => setFallback(true)}
      />
    )
  }

  return (
    <span className="shortcut-dock__icon shortcut-dock__icon--text" aria-hidden="true">
      {shortcut.title.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * 底部毛玻璃 Dock（设计文档 3.2）。
 * 顶部槽位承载搜索框；下方为当前环境下解析出的快捷方式。
 * 半透明背景色是 backdrop-filter 不可用时的兜底。
 * 0003 改善 1/2：快捷方式与分组支持右键菜单（编辑/重命名/删除）。
 * 0003 改善 3：左右边缘把手拖拽调节宽度，双击/Enter 恢复自动。
 */
export default function ShortcutDock({
  children,
  onRequestAdd,
  onRequestEditShortcut,
}: ShortcutDockProps) {
  const { config, updateConfig } = useConfig()
  // 分组筛选（0001 改善 7）：本地状态，不跨会话持久化。
  const [activeTab, setActiveTab] = useState<string>('all')
  const [menu, setMenu] = useState<DockMenu | null>(null)
  // 两步确认：'shortcut:<id>' / 'group:<id>'。
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // 分组重命名内联输入（0003 改善 2）。
  const [renaming, setRenaming] = useState<{ groupId: string; name: string } | null>(null)
  // 拖拽中的临时宽度（px）；松手才落盘。
  const [draggingWidth, setDraggingWidth] = useState<number | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  if (!config) {
    return null
  }

  const groups = [...config.shortcutGroups].sort((a, b) => a.order - b.order)
  // 选中分组被删除后回退「全部」。
  const effectiveTab =
    activeTab !== 'all' && groups.some((group) => group.id === activeTab) ? activeTab : 'all'
  const activeEnvironment =
    config.environments.find((env) => env.id === config.settings.activeEnvironmentId) ??
    config.environments[0]
  const variables = activeEnvironment?.variables ?? {}
  const iconSize = config.settings.dock.iconSize
  const showLabels = config.settings.dock.showLabels
  // 手动宽度（拖拽预览优先于落盘值）；缺省自动铺满。
  const manualWidth = draggingWidth ?? config.settings.dock.width

  const sorted = [...config.shortcuts].sort((a, b) => a.order - b.order)
  const filtered = effectiveTab === 'all' ? sorted : sorted.filter((s) => s.groupId === effectiveTab)
  const addSize = Math.max(iconSize, 48)

  const addButton = (
    <button
      type="button"
      className="shortcut-dock__add"
      style={{ width: addSize, height: addSize }}
      aria-label="添加快捷方式"
      title="添加快捷方式"
      onClick={onRequestAdd}
    >
      +
    </button>
  )

  function openMenu(next: DockMenu) {
    setPendingDelete(null)
    setMenu(next)
  }

  function deleteShortcut(shortcutId: string) {
    void updateConfig((draft) => {
      draft.shortcuts = draft.shortcuts.filter((item) => item.id !== shortcutId)
      // 重新连续编号，避免空洞。
      draft.shortcuts
        .sort((a, b) => a.order - b.order)
        .forEach((item, order) => {
          item.order = order
        })
    })
    setPendingDelete(null)
  }

  /** 删除分组：组内快捷方式移入排序最前的剩余分组；至少保留一个分组。 */
  function deleteGroup(groupId: string) {
    void updateConfig((draft) => {
      if (draft.shortcutGroups.length <= 1) return
      draft.shortcutGroups = draft.shortcutGroups.filter((group) => group.id !== groupId)
      const fallback = [...draft.shortcutGroups].sort((a, b) => a.order - b.order)[0]
      if (fallback) {
        for (const shortcut of draft.shortcuts) {
          if (shortcut.groupId === groupId) shortcut.groupId = fallback.id
        }
      }
    })
    setPendingDelete(null)
  }

  function commitRename(groupId: string) {
    const current = renaming
    setRenaming(null)
    if (!current || current.groupId !== groupId) return
    const name = current.name.trim()
    if (!name) return
    void updateConfig((draft) => {
      const group = draft.shortcutGroups.find((item) => item.id === groupId)
      if (group) group.name = name
    })
  }

  function startResize(side: 'left' | 'right') {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)
      const startX = event.clientX
      const startWidth =
        dockRef.current?.getBoundingClientRect().width ?? window.innerWidth
      let nextWidth = startWidth

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX
        const delta = side === 'left' ? -dx : dx
        const maxWidth = window.innerWidth - DOCK_VIEWPORT_MARGIN * 2
        nextWidth = Math.max(DOCK_MIN_WIDTH, Math.min(maxWidth, startWidth + delta * 2))
        setDraggingWidth(nextWidth)
      }
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
        handle.removeEventListener('pointercancel', onUp)
        setDraggingWidth(null)
        if (nextWidth !== startWidth) {
          void updateConfig((draft) => {
            draft.settings.dock.width = Math.round(nextWidth)
          })
        }
      }
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
      handle.addEventListener('pointercancel', onUp)
    }
  }

  /** 双击/Enter 恢复自动宽度。 */
  function resetWidth() {
    void updateConfig((draft) => {
      delete draft.settings.dock.width
    })
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 64 : 16
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const current = dockRef.current?.getBoundingClientRect().width ?? window.innerWidth
      const maxWidth = window.innerWidth - DOCK_VIEWPORT_MARGIN * 2
      const next =
        event.key === 'ArrowLeft'
          ? Math.max(DOCK_MIN_WIDTH, current - step)
          : Math.min(maxWidth, current + step)
      void updateConfig((draft) => {
        draft.settings.dock.width = Math.round(next)
      })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      resetWidth()
    }
  }

  const buildShortcutMenu = (shortcutId: string, x: number, y: number) => {
    const shortcut = config.shortcuts.find((item) => item.id === shortcutId)
    if (!shortcut) return
    const confirmKey = `shortcut:${shortcut.id}`
    const items: DockMenuItem[] = [
      {
        id: 'edit',
        label: '编辑',
        onSelect: () => onRequestEditShortcut(shortcut),
      },
      {
        id: 'delete',
        label: pendingDelete === confirmKey ? '确认删除？' : '删除',
        danger: true,
        keepOpen: pendingDelete !== confirmKey,
        onSelect: () => {
          if (pendingDelete === confirmKey) {
            deleteShortcut(shortcut.id)
          } else {
            setPendingDelete(confirmKey)
          }
        },
      },
    ]
    return <DockContextMenu x={x} y={y} items={items} onClose={() => setMenu(null)} />
  }

  const buildGroupMenu = (groupId: string, x: number, y: number) => {
    const confirmKey = `group:${groupId}`
    const items: DockMenuItem[] = [
      {
        id: 'rename',
        label: '重命名',
        onSelect: () => {
          const group = config.shortcutGroups.find((item) => item.id === groupId)
          if (group) setRenaming({ groupId, name: group.name })
        },
      },
      {
        id: 'delete',
        label: pendingDelete === confirmKey ? '确认删除？' : '删除',
        danger: true,
        disabled: groups.length <= 1,
        keepOpen: pendingDelete !== confirmKey,
        onSelect: () => {
          if (pendingDelete === confirmKey) {
            deleteGroup(groupId)
          } else {
            setPendingDelete(confirmKey)
          }
        },
      },
    ]
    return <DockContextMenu x={x} y={y} items={items} onClose={() => setMenu(null)} />
  }

  const shortcutMenu =
    menu?.kind === 'shortcut' ? buildShortcutMenu(menu.shortcutId, menu.x, menu.y) : null
  const groupMenu = menu?.kind === 'group' ? buildGroupMenu(menu.groupId, menu.x, menu.y) : null

  const widthStyle =
    manualWidth != null
      ? {
          width: manualWidth,
          maxWidth: `calc(100vw - ${DOCK_VIEWPORT_MARGIN * 2}px)`,
          left: '50%',
          right: 'auto',
          transform: 'translateX(-50%)',
        }
      : undefined

  return (
    <div ref={dockRef} className="shortcut-dock" style={widthStyle}>
      {children}
      {groups.length > 1 && (
        <div className="shortcut-dock__tabs" role="toolbar" aria-label="快捷方式分组筛选">
          <button
            type="button"
            className={`shortcut-dock__tab${effectiveTab === 'all' ? ' shortcut-dock__tab--active' : ''}`}
            aria-pressed={effectiveTab === 'all'}
            onClick={() => setActiveTab('all')}
          >
            全部
          </button>
          {groups.map((group) => (
            <div key={group.id} className="shortcut-dock__tab-slot">
              {renaming?.groupId === group.id ? (
                <input
                  className="shortcut-dock__tab-rename"
                  value={renaming.name}
                  maxLength={24}
                  autoFocus
                  aria-label={`重命名分组 ${group.name}`}
                  onChange={(event) =>
                    setRenaming({ groupId: group.id, name: event.target.value })
                  }
                  onBlur={() => commitRename(group.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitRename(group.id)
                    } else if (event.key === 'Escape') {
                      setRenaming(null)
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`shortcut-dock__tab${effectiveTab === group.id ? ' shortcut-dock__tab--active' : ''}`}
                  aria-pressed={effectiveTab === group.id}
                  onClick={() => setActiveTab(group.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    openMenu({ kind: 'group', groupId: group.id, x: event.clientX, y: event.clientY })
                  }}
                >
                  {group.name}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {filtered.length === 0 && (
        <p className="shortcut-dock__empty">
          {effectiveTab === 'all' ? '还没有快捷方式，点击下方「+」添加常用网站' : '该分组还没有快捷方式'}
        </p>
      )}
      <ul className="shortcut-dock__row">
        {filtered.map((shortcut) => {
            const resolved = resolveShortcutUrl(shortcut.urlTemplate, variables)
            const openShortcutMenu = (event: React.MouseEvent) => {
              event.preventDefault()
              openMenu({ kind: 'shortcut', shortcutId: shortcut.id, x: event.clientX, y: event.clientY })
            }

            if (!resolved.ok) {
              const message =
                RESOLVE_ERROR_MESSAGES[resolved.error.code as ResolveErrorCode] ??
                resolved.error.message
              return (
                <li key={shortcut.id} className="shortcut-dock__cell">
                  <span
                    className="shortcut-dock__item shortcut-dock__item--error"
                    style={{ width: iconSize, height: iconSize }}
                    title={message}
                    onContextMenu={openShortcutMenu}
                  >
                    <span
                      className="shortcut-dock__icon shortcut-dock__icon--text"
                      aria-hidden="true"
                    >
                      !
                    </span>
                    <span className="visually-hidden">
                      {shortcut.title}：{message}
                    </span>
                  </span>
                  {showLabels && (
                    <span className="shortcut-dock__label">{shortcut.title}</span>
                  )}
                </li>
              )
            }

            return (
              <li key={shortcut.id} className="shortcut-dock__cell">
                <a
                  className="shortcut-dock__item"
                  style={{ width: iconSize, height: iconSize }}
                  href={resolved.data}
                  title={shortcut.title}
                  aria-label={shortcut.title}
                  onContextMenu={openShortcutMenu}
                >
                  <ShortcutIcon shortcut={shortcut} resolvedUrl={resolved.data} />
                </a>
                {showLabels && <span className="shortcut-dock__label">{shortcut.title}</span>}
              </li>
            )
          })}
          <li className="shortcut-dock__cell">{addButton}</li>
      </ul>
      <div
        className="shortcut-dock__handle shortcut-dock__handle--left"
        role="slider"
        tabIndex={0}
        aria-label="调整 Dock 宽度（拖动或方向键，双击/Enter 恢复自动）"
        aria-orientation="vertical"
        aria-valuemin={DOCK_MIN_WIDTH}
        aria-valuenow={dockRef.current?.getBoundingClientRect().width ?? undefined}
        onPointerDown={startResize('left')}
        onDoubleClick={resetWidth}
        onKeyDown={handleResizeKeyDown}
      />
      <div
        className="shortcut-dock__handle shortcut-dock__handle--right"
        role="slider"
        tabIndex={0}
        aria-label="调整 Dock 宽度（拖动或方向键，双击/Enter 恢复自动）"
        aria-orientation="vertical"
        aria-valuemin={DOCK_MIN_WIDTH}
        aria-valuenow={dockRef.current?.getBoundingClientRect().width ?? undefined}
        onPointerDown={startResize('right')}
        onDoubleClick={resetWidth}
        onKeyDown={handleResizeKeyDown}
      />
      {shortcutMenu}
      {groupMenu}
    </div>
  )
}
