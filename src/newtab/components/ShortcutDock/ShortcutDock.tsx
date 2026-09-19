import { useState, type ReactNode } from 'react'
import { useConfig } from '../../config/config-context'
import type { Shortcut } from '../../../shared/models/config'
import {
  RESOLVE_ERROR_MESSAGES,
  type ResolveErrorCode,
  resolveShortcutUrl,
} from '../../../shared/services/environment-resolver'
import './ShortcutDock.css'

export type ShortcutDockProps = {
  children: ReactNode
  /** 点击「+」请求打开快捷添加弹窗（弹窗由 App 持有，供拖拽预填复用）。 */
  onRequestAdd: () => void
}

/** 取最终 URL 同源的 /favicon.ico，避免把内网域名泄露给第三方图标服务。 */
function getFaviconUrl(resolvedUrl: string): string | null {
  try {
    return new URL('/favicon.ico', resolvedUrl).href
  } catch {
    return null
  }
}

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
 */
export default function ShortcutDock({ children, onRequestAdd }: ShortcutDockProps) {
  const { config } = useConfig()
  // 分组筛选（0001 改善 7）：本地状态，不跨会话持久化。
  const [activeTab, setActiveTab] = useState<string>('all')

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

  return (
    <div className="shortcut-dock">
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
            <button
              key={group.id}
              type="button"
              className={`shortcut-dock__tab${effectiveTab === group.id ? ' shortcut-dock__tab--active' : ''}`}
              aria-pressed={effectiveTab === group.id}
              onClick={() => setActiveTab(group.id)}
            >
              {group.name}
            </button>
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
                >
                  <ShortcutIcon shortcut={shortcut} resolvedUrl={resolved.data} />
                </a>
                {showLabels && <span className="shortcut-dock__label">{shortcut.title}</span>}
              </li>
            )
          })}
          <li className="shortcut-dock__cell">{addButton}</li>
      </ul>
    </div>
  )
}
