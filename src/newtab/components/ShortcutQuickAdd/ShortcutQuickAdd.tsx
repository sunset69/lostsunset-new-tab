import { useEffect, useRef, useState } from 'react'
import { useConfig } from '../../config/config-context'
import { createShortcutDraft } from '../../../shared/config/default-config'
import { defaultTitleFromUrl, normalizeUrlInput } from '../../../shared/utils/url-input'
import './ShortcutQuickAdd.css'

export type ShortcutQuickAddInitial = {
  url?: string
  title?: string
}

export type ShortcutQuickAddProps = {
  /** 拖拽预填：URL 与可选标题。 */
  initial?: ShortcutQuickAddInitial
  /** 新快捷方式默认落到的分组。 */
  defaultGroupId: string
  onClose: () => void
}

type IconChoice = 'favicon' | 'emoji' | 'initial'

type FormErrors = { url?: string; emoji?: string }

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 快捷添加弹窗（0001 改善 6a / 设计 4.1）：
 * Dock「+」与拖拽链接共用；URL 规范化校验，名称留空自动取域名。
 */
export default function ShortcutQuickAdd({ initial, defaultGroupId, onClose }: ShortcutQuickAddProps) {
  const { config, updateConfig } = useConfig()
  const groups = [...(config?.shortcutGroups ?? [])].sort((a, b) => a.order - b.order)
  const [url, setUrl] = useState(initial?.url ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [groupId, setGroupId] = useState(() =>
    groups.some((group) => group.id === defaultGroupId) ? defaultGroupId : (groups[0]?.id ?? ''),
  )
  // 配置加载晚于挂载或选中分组被删除时，回退到第一个分组。
  const effectiveGroupId = groups.some((group) => group.id === groupId)
    ? groupId
    : (groups[0]?.id ?? '')
  const [iconChoice, setIconChoice] = useState<IconChoice>('favicon')
  const [emoji, setEmoji] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape 关闭；Tab 在弹窗内循环（焦点圈定）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && dialog.contains(active)
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // 配置未加载时不渲染（App 仅在配置就绪后打开弹窗；测试等待弹窗出现即可）。
  if (!config) {
    return null
  }

  function clearError(key: keyof FormErrors) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const parsed = normalizeUrlInput(url)
    const emojiError =
      iconChoice === 'emoji' && !emoji.trim() ? '使用表情图标时请填写一个表情字符' : null

    if ('error' in parsed) {
      setErrors({ url: parsed.error, emoji: emojiError ?? undefined })
      return
    }
    if (emojiError) {
      setErrors({ url: undefined, emoji: emojiError })
      return
    }

    const finalUrl = parsed.url
    const finalTitle = (title.trim() || defaultTitleFromUrl(finalUrl)).slice(0, 32)

    void updateConfig((draft) => {
      const order = draft.shortcuts.reduce((max, item) => Math.max(max, item.order), -1) + 1
      const shortcut = createShortcutDraft(effectiveGroupId, order)
      shortcut.title = finalTitle
      shortcut.urlTemplate = finalUrl
      shortcut.icon =
        iconChoice === 'emoji'
          ? { type: 'emoji', value: emoji.trim() }
          : { type: iconChoice === 'favicon' ? 'favicon' : 'custom', value: '' }
      draft.shortcuts.push(shortcut)
    })
    onClose()
  }

  return (
    <div className="quick-add__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="quick-add"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="quick-add__heading" id="quick-add-title">
          添加快捷方式
        </h2>

        <form className="quick-add__form" onSubmit={handleSubmit} noValidate>
          <div className="quick-add__field">
            <label className="quick-add__label" htmlFor="quick-add-url">
              网址
            </label>
            <input
              id="quick-add-url"
              className="quick-add__input"
              type="text"
              inputMode="url"
              spellCheck={false}
              autoFocus
              placeholder="example.com 或 https://…"
              value={url}
              aria-invalid={errors.url ? true : undefined}
              aria-describedby={errors.url ? 'quick-add-url-error' : undefined}
              onChange={(event) => {
                setUrl(event.target.value)
                clearError('url')
              }}
            />
            {errors.url && (
              <p className="quick-add__error" id="quick-add-url-error" role="alert">
                {errors.url}
              </p>
            )}
          </div>

          <div className="quick-add__field">
            <label className="quick-add__label" htmlFor="quick-add-name">
              名称（留空自动取域名）
            </label>
            <input
              id="quick-add-name"
              className="quick-add__input"
              type="text"
              maxLength={32}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="quick-add__field">
            <label className="quick-add__label" htmlFor="quick-add-group">
              分组
            </label>
            <select
              id="quick-add-group"
              className="quick-add__input"
              value={effectiveGroupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="quick-add__field">
            <label className="quick-add__label" htmlFor="quick-add-icon">
              图标
            </label>
            <select
              id="quick-add-icon"
              className="quick-add__input"
              value={iconChoice}
              onChange={(event) => {
                setIconChoice(event.target.value as IconChoice)
                clearError('emoji')
              }}
            >
              <option value="favicon">网站图标（失败时用名称首字）</option>
              <option value="emoji">表情字符</option>
              <option value="initial">名称首字母</option>
            </select>
          </div>

          {iconChoice === 'emoji' && (
            <div className="quick-add__field">
              <label className="quick-add__label" htmlFor="quick-add-emoji">
                表情
              </label>
              <input
                id="quick-add-emoji"
                className="quick-add__input"
                type="text"
                maxLength={8}
                placeholder="例如 🛠️"
                value={emoji}
                aria-invalid={errors.emoji ? true : undefined}
                onChange={(event) => {
                  setEmoji(event.target.value)
                  clearError('emoji')
                }}
              />
              {errors.emoji && (
                <p className="quick-add__error" role="alert">
                  {errors.emoji}
                </p>
              )}
            </div>
          )}

          <div className="quick-add__actions">
            <button type="button" className="quick-add__btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="quick-add__btn quick-add__btn--primary">
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
