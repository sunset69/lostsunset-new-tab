import { useEffect, useRef, useState } from 'react'
import type { Environment } from '../../../shared/models/config'
import './EnvironmentSwitcher.css'

type EnvironmentSwitcherProps = {
  environments: Environment[]
  activeId: string
  onSelect: (environmentId: string) => void
}

/**
 * 环境切换器（002 改善 1：原生 select 美化）。
 * 自定义 listbox 下拉：保留完整键盘行为（方向键/Home/End/Enter/Esc/Tab 移出关闭）、
 * 读屏语义与焦点管理；视觉与搜索框引擎菜单统一。
 */
export default function EnvironmentSwitcher({
  environments,
  activeId,
  onSelect,
}: EnvironmentSwitcherProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // 打开时首个焦点项：Enter/Space/ArrowDown 聚焦当前项，ArrowUp 聚焦末项。
  const focusIndexRef = useRef(0)

  const activeIndex = Math.max(
    0,
    environments.findIndex((env) => env.id === activeId),
  )
  const active = environments[activeIndex]

  function optionElements(): HTMLElement[] {
    return listRef.current
      ? Array.from(listRef.current.querySelectorAll<HTMLElement>('[role="option"]'))
      : []
  }

  function focusOption(index: number) {
    const items = optionElements()
    if (items.length === 0) return
    const clamped = ((index % items.length) + items.length) % items.length
    items[clamped]?.focus()
  }

  function openMenu(focusIndex: number) {
    focusIndexRef.current = focusIndex
    setOpen(true)
  }

  function choose(id: string) {
    onSelect(id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  // 打开后聚焦目标选项。
  useEffect(() => {
    if (!open) return
    focusOption(focusIndexRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 外部点击 / 焦点移出 / Escape 关闭。
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function handleButtonKeyDown(event: React.KeyboardEvent) {
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      openMenu(activeIndex)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openMenu(activeIndex)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(environments.length - 1)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') && !open) {
      event.preventDefault()
      openMenu(activeIndex)
    }
  }

  function handleListKeyDown(event: React.KeyboardEvent) {
    const items = optionElements()
    const current = items.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusOption(current + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusOption(current - 1)
        break
      case 'Home':
        event.preventDefault()
        focusOption(0)
        break
      case 'End':
        event.preventDefault()
        focusOption(items.length - 1)
        break
      case 'Enter':
      case ' ':
      case 'Spacebar': {
        event.preventDefault()
        const selected = items[current]
        if (selected) {
          const id = selected.dataset.envId
          if (id) choose(id)
        }
        break
      }
      case 'Tab':
        setOpen(false)
        break
      default:
        // 简易首字符跳转。
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const lower = event.key.toLowerCase()
          const hit = environments.findIndex((env) => env.name.trimStart().toLowerCase().startsWith(lower))
          if (hit >= 0) focusOption(hit)
        }
    }
  }

  return (
    <div className="env-switcher" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="env-switcher__chip"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={environments.length === 0}
        aria-label={`当前环境：${active?.name ?? '未选择'}，切换环境`}
        title="切换环境"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleButtonKeyDown}
      >
        <span
          className="env-switcher__dot"
          style={{ backgroundColor: active?.color ?? '#38bdf8' }}
          aria-hidden="true"
        />
        <span className="env-switcher__name">{active?.name ?? '未选择环境'}</span>
        <svg
          className={`env-switcher__chevron${open ? ' env-switcher__chevron--open' : ''}`}
          viewBox="0 0 24 24"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m6 9 6 6 6-6H6Z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          className="env-switcher__menu"
          role="listbox"
          aria-label="选择环境"
          onKeyDown={handleListKeyDown}
        >
          {environments.map((env) => {
            const selected = env.id === activeId
            return (
              <li key={env.id} className="env-switcher__item" role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-env-id={env.id}
                  tabIndex={-1}
                  className={`env-switcher__option${selected ? ' env-switcher__option--active' : ''}`}
                  onClick={() => choose(env.id)}
                >
                  <span
                    className="env-switcher__option-dot"
                    style={{ backgroundColor: env.color ?? '#38bdf8' }}
                    aria-hidden="true"
                  />
                  <span className="env-switcher__option-name">{env.name}</span>
                  {selected && (
                    <svg
                      className="env-switcher__check"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M9.55 18.05 4.1 12.6l1.4-1.4 4.05 4.05 8.95-8.95 1.4 1.4-10.35 10.35Z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
