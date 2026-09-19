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
export default function ShortcutDock({ children }: ShortcutDockProps) {
  const { config } = useConfig()

  if (!config) {
    return null
  }

  const activeEnvironment =
    config.environments.find((env) => env.id === config.settings.activeEnvironmentId) ??
    config.environments[0]
  const variables = activeEnvironment?.variables ?? {}
  const iconSize = config.settings.dock.iconSize
  const showLabels = config.settings.dock.showLabels

  const sorted = [...config.shortcuts].sort((a, b) => a.order - b.order)

  return (
    <div className="shortcut-dock">
      {children}
      {sorted.length === 0 ? (
        <p className="shortcut-dock__empty">还没有快捷方式，点击右上角「设置」添加常用网站</p>
      ) : (
        <ul className="shortcut-dock__row">
          {sorted.map((shortcut) => {
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
        </ul>
      )}
    </div>
  )
}
