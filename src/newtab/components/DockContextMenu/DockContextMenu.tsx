import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './DockContextMenu.css'

export type DockMenuItem = {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  /** true 时点击后菜单保持打开（如「删除 → 确认删除？」两步确认）。 */
  keepOpen?: boolean
  onSelect: () => void
}

type DockContextMenuProps = {
  /** 打开时的视口坐标（通常为鼠标右键位置）。 */
  x: number
  y: number
  items: DockMenuItem[]
  onClose: () => void
}

/**
 * Dock 右键菜单（0003 改善 1/2）：
 * fixed 定位 + 视口内钳制；打开聚焦首项，方向键/Home/End 移动，
 * Escape/Tab/点击外部关闭；关闭后焦点归还触发元素（选中项主动转移焦点时除外）。
 */
export default function DockContextMenu({ x, y, items, onClose }: DockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const selectingRef = useRef(false)

  useLayoutEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const nextX = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
    const nextY = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
    setPos({ x: nextX, y: nextY })
    menu.querySelector<HTMLButtonElement>('button[data-menu-item]')?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const menu = menuRef.current
      if (menu && event.target instanceof Node && menu.contains(event.target)) return
      onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      // 仅在焦点仍停留在菜单内（Esc/外部点击关闭）时归还焦点；
      // 选择菜单项触发的焦点转移（如打开编辑弹窗）不打断。
      if (!selectingRef.current) {
        restoreFocusRef.current?.focus()
      }
    }
  }, [onClose])

  function handleKeyDown(event: React.KeyboardEvent) {
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button[data-menu-item]') ?? [],
    ).filter((button) => !button.disabled)
    if (buttons.length === 0) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      buttons[(index + 1 + buttons.length) % buttons.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      buttons[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      buttons[buttons.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="dock-context-menu"
      role="menu"
      aria-label="快捷操作"
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          data-menu-item
          disabled={item.disabled}
          className={`dock-context-menu__item${item.danger ? ' dock-context-menu__item--danger' : ''}`}
          onClick={() => {
            if (item.keepOpen) {
              item.onSelect()
              return
            }
            selectingRef.current = true
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
