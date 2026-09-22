import { useState } from 'react'
import { useConfig } from '../../config/config-context'
import { DEFAULT_GROUP_ID } from '../../../shared/config/default-config'
import type { Shortcut, ShortcutIconType } from '../../../shared/models/config'
import { createId } from '../../../shared/utils/id'
import { normalizeUrlInput } from '../../../shared/utils/url-input'
import {
  RESOLVE_ERROR_MESSAGES,
  type ResolveErrorCode,
  resolveShortcutUrl,
  validateUrlTemplate,
} from '../../../shared/services/environment-resolver'

type FormState = {
  id: string | null
  title: string
  urlTemplate: string
  iconType: Extract<ShortcutIconType, 'favicon' | 'emoji' | 'image'>
  iconValue: string
}

function blankForm(): FormState {
  return { id: null, title: '', urlTemplate: '', iconType: 'favicon', iconValue: '' }
}

/** 快捷方式管理（设计文档 2.1.3 / 3.3）：CRUD + 排序 + 实时 URL 预览。 */
export default function ShortcutSection() {
  const { config, updateConfig } = useConfig()
  const shortcuts = config!.shortcuts
  const activeEnvironment =
    config!.environments.find((env) => env.id === config!.settings.activeEnvironmentId) ??
    config!.environments[0]

  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const sorted = [...shortcuts].sort((a, b) => a.order - b.order)

  function startCreate() {
    setConfirmDeleteId(null)
    setError(null)
    setForm(blankForm())
  }

  function startEdit(shortcut: Shortcut) {
    setConfirmDeleteId(null)
    setError(null)
    setForm({
      id: shortcut.id,
      title: shortcut.title,
      urlTemplate: shortcut.urlTemplate,
      iconType:
        shortcut.icon.type === 'emoji'
          ? 'emoji'
          : shortcut.icon.type === 'image'
            ? 'image'
            : 'favicon',
      iconValue:
        shortcut.icon.type === 'emoji' || shortcut.icon.type === 'image'
          ? shortcut.icon.value
          : '',
    })
  }

  function reorder(shortcutId: string, direction: -1 | 1) {
    const index = sorted.findIndex((item) => item.id === shortcutId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= sorted.length) return
    const next = [...sorted]
    ;[next[index], next[target]] = [next[target], next[index]]
    void updateConfig((draft) => {
      next.forEach((item, order) => {
        const found = draft.shortcuts.find((s) => s.id === item.id)
        if (found) found.order = order
      })
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form) return

    const title = form.title.trim()
    const urlTemplate = form.urlTemplate.trim()
    if (!title) {
      setError('快捷方式标题不能为空')
      return
    }
    const templateCheck = validateUrlTemplate(urlTemplate)
    if (!templateCheck.ok) {
      setError(
        RESOLVE_ERROR_MESSAGES[templateCheck.error.code as ResolveErrorCode] ??
          templateCheck.error.message,
      )
      return
    }
    let icon: Shortcut['icon']
    if (form.iconType === 'emoji') {
      if (!form.iconValue.trim()) {
        setError('使用表情图标时请填写一个表情字符')
        return
      }
      icon = { type: 'emoji', value: form.iconValue.trim() }
    } else if (form.iconType === 'image') {
      const parsedIcon = normalizeUrlInput(form.iconValue)
      if ('error' in parsedIcon) {
        setError(parsedIcon.error)
        return
      }
      icon = { type: 'image', value: parsedIcon.url }
    } else {
      icon = { type: 'favicon', value: '' }
    }

    const id = form.id ?? createId('shortcut')
    const shortcut: Shortcut = {
      id,
      groupId: DEFAULT_GROUP_ID,
      title,
      urlTemplate,
      icon,
      order: form.id
        ? shortcuts.find((item) => item.id === form.id)?.order ?? shortcuts.length
        : shortcuts.length,
    }

    void updateConfig((draft) => {
      const index = draft.shortcuts.findIndex((item) => item.id === id)
      if (index >= 0) {
        draft.shortcuts[index] = shortcut
      } else {
        draft.shortcuts.push(shortcut)
      }
    })
    setForm(null)
    setError(null)
  }

  function handleDelete(shortcutId: string) {
    void updateConfig((draft) => {
      draft.shortcuts = draft.shortcuts.filter((item) => item.id !== shortcutId)
      // 重新连续编号，避免空洞。
      draft.shortcuts
        .sort((a, b) => a.order - b.order)
        .forEach((item, order) => {
          item.order = order
        })
    })
    setConfirmDeleteId(null)
  }

  const preview = form
    ? resolveShortcutUrl(form.urlTemplate, activeEnvironment?.variables ?? {})
    : null

  return (
    <div>
      <ul className="item-list">
        {sorted.map((shortcut, index) => (
          <li key={shortcut.id} className="item-list__row">
            <span className="item-list__name" title={shortcut.urlTemplate}>
              {shortcut.title}
              <span className="item-list__sub">{shortcut.urlTemplate}</span>
            </span>
            <span className="item-list__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                aria-label={`上移 ${shortcut.title}`}
                disabled={index === 0}
                onClick={() => reorder(shortcut.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                aria-label={`下移 ${shortcut.title}`}
                disabled={index === sorted.length - 1}
                onClick={() => reorder(shortcut.id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => startEdit(shortcut)}
              >
                编辑
              </button>
              {confirmDeleteId === shortcut.id ? (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => handleDelete(shortcut.id)}
                >
                  确认删除？
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirmDeleteId(shortcut.id)}
                >
                  删除
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {!form && (
        <button type="button" className="btn btn--ghost" onClick={startCreate}>
          添加快捷方式
        </button>
      )}

      {form && (
        <form className="form form--inline" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="shortcut-title">
              标题
            </label>
            <input
              id="shortcut-title"
              className="field__input"
              type="text"
              value={form.title}
              maxLength={32}
              required
              autoFocus
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="shortcut-url">
              地址
            </label>
            <input
              id="shortcut-url"
              className="field__input field__input--mono"
              type="text"
              inputMode="url"
              spellCheck={false}
              value={form.urlTemplate}
              required
              aria-describedby="shortcut-url-preview"
              onChange={(event) => setForm({ ...form, urlTemplate: event.target.value })}
            />
            <p className="field__help" id="shortcut-url-preview" aria-live="polite">
              当前环境预览：
              {preview?.ok ? (
                <span className="preview--ok">{preview.data}</span>
              ) : (
                <span className="preview--error">
                  {form.urlTemplate.trim() === ''
                    ? '填写后显示解析结果'
                    : preview
                      ? RESOLVE_ERROR_MESSAGES[preview.error.code as ResolveErrorCode] ??
                        preview.error.message
                      : ''}
                </span>
              )}
            </p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="shortcut-icon-type">
              图标
            </label>
            <select
              id="shortcut-icon-type"
              className="field__input"
              value={form.iconType}
              onChange={(event) =>
                setForm({ ...form, iconType: event.target.value as FormState['iconType'] })
              }
            >
              <option value="favicon">网站 favicon（失败时用标题首字）</option>
              <option value="emoji">表情字符</option>
              <option value="image">自定义图片 URL（失败时用标题首字）</option>
            </select>
          </div>

          {form.iconType === 'emoji' && (
            <div className="field">
              <label className="field__label" htmlFor="shortcut-icon-value">
                表情
              </label>
              <input
                id="shortcut-icon-value"
                className="field__input"
                type="text"
                maxLength={8}
                value={form.iconValue}
                placeholder="例如 🛠️"
                onChange={(event) => setForm({ ...form, iconValue: event.target.value })}
              />
            </div>
          )}

          {form.iconType === 'image' && (
            <div className="field">
              <label className="field__label" htmlFor="shortcut-icon-url">
                图标 URL
              </label>
              <input
                id="shortcut-icon-url"
                className="field__input field__input--mono"
                type="text"
                inputMode="url"
                spellCheck={false}
                value={form.iconValue}
                placeholder="https://example.com/icon.png"
                onChange={(event) => setForm({ ...form, iconValue: event.target.value })}
              />
            </div>
          )}

          {error && <p className="field__error">{error}</p>}

          <div className="form__actions">
            <button type="submit" className="btn btn--primary">
              保存快捷方式
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setForm(null)
                setError(null)
              }}
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
