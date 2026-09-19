import { useState } from 'react'
import { useConfig } from '../../config/config-context'
import { isValidSearchTemplate } from '../../../shared/utils/url-search'
import { createSearchEngineDraft, SEARCH_ENGINE_PRESETS } from '../../../shared/config/default-config'
import type { SearchEngine } from '../../../shared/models/config'

type EngineDraft = { name: string; keyword: string; template: string }

/**
 * 搜索引擎设置（0001 改善 4/5 设计 3.1/3.3）：
 * 列表 CRUD、预设快速添加、上移/下移、删除活跃引擎回退第一项、至少保留一个。
 */
export default function SearchEngineSection() {
  const { config, updateConfig } = useConfig()
  const engines = config!.settings.searchEngines
  const activeId = config!.settings.activeSearchEngineId

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EngineDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  function startEdit(engine: SearchEngine) {
    setEditingId(engine.id)
    setDraft({
      name: engine.name,
      keyword: engine.keyword ?? '',
      template: engine.searchUrlTemplate,
    })
    setError(null)
    setWarning(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
    setWarning(null)
  }

  function keywordConflict(id: string, keyword: string): boolean {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return false
    return engines.some(
      (engine) => engine.id !== id && (engine.keyword ?? '').trim().toLowerCase() === normalized,
    )
  }

  function saveEdit() {
    if (!editingId || !draft) return
    if (!draft.name.trim()) {
      setError('引擎名称不能为空')
      return
    }
    if (!isValidSearchTemplate(draft.template.trim())) {
      setError('搜索地址不合法，且必须包含 {{query}} 占位符')
      return
    }
    setWarning(
      keywordConflict(editingId, draft.keyword)
        ? '该关键词与其他引擎重复，实际生效顺序以列表靠前者为准'
        : null,
    )
    setError(null)
    void updateConfig((root) => {
      const target = root.settings.searchEngines.find((item) => item.id === editingId)
      if (target) {
        target.name = draft.name.trim()
        target.keyword = draft.keyword.trim()
        target.searchUrlTemplate = draft.template.trim()
      }
    })
    setEditingId(null)
    setDraft(null)
  }

  function removeEngine(id: string) {
    if (engines.length <= 1) return
    setWarning(null)
    void updateConfig((root) => {
      root.settings.searchEngines = root.settings.searchEngines.filter(
        (item) => item.id !== id,
      )
      if (root.settings.activeSearchEngineId === id) {
        root.settings.activeSearchEngineId = root.settings.searchEngines[0].id
      }
    })
  }

  function moveEngine(id: string, direction: -1 | 1) {
    void updateConfig((root) => {
      const list = root.settings.searchEngines
      const from = list.findIndex((item) => item.id === id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= list.length) return
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
    })
  }

  function addPreset(preset: SearchEngine) {
    if (engines.some((engine) => engine.id === preset.id)) return
    setWarning(null)
    void updateConfig((root) => {
      root.settings.searchEngines.push({ ...preset })
    })
  }

  function addCustom() {
    if (editingId !== null) return
    const fresh = createSearchEngineDraft()
    void updateConfig((root) => {
      root.settings.searchEngines.push({ ...fresh })
    })
    setEditingId(fresh.id)
    setDraft({ name: '', keyword: '', template: '' })
    setError(null)
  }

  const availablePresets = SEARCH_ENGINE_PRESETS.filter(
    (preset) => !engines.some((engine) => engine.id === preset.id),
  )

  return (
    <div className="engine-settings">
      <ul className="engine-list">
        {engines.map((engine, index) => {
          const editing = editingId === engine.id
          return (
            <li key={engine.id} className="engine-list__item">
              {editing && draft ? (
                <form
                  className="engine-edit"
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveEdit()
                  }}
                  noValidate
                >
                  <div className="field">
                    <label className="field__label" htmlFor={`engine-name-${engine.id}`}>
                      引擎名称
                    </label>
                    <input
                      id={`engine-name-${engine.id}`}
                      className="field__input"
                      type="text"
                      value={draft.name}
                      maxLength={32}
                      required
                      aria-invalid={error !== null}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`engine-keyword-${engine.id}`}>
                      关键词（输入后按空格调用，可留空）
                    </label>
                    <input
                      id={`engine-keyword-${engine.id}`}
                      className="field__input"
                      type="text"
                      value={draft.keyword}
                      maxLength={24}
                      spellCheck={false}
                      onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`engine-template-${engine.id}`}>
                      搜索地址
                    </label>
                    <input
                      id={`engine-template-${engine.id}`}
                      className="field__input field__input--mono"
                      type="url"
                      inputMode="url"
                      spellCheck={false}
                      value={draft.template}
                      required
                      aria-invalid={error !== null}
                      onChange={(event) => setDraft({ ...draft, template: event.target.value })}
                    />
                    <p className="field__help">例如 https://www.bing.com/search?q={'{{query}}'}</p>
                    {error && (
                      <p className="field__error" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <div className="engine-edit__actions">
                    <button type="submit" className="btn btn--primary">
                      保存
                    </button>
                    <button type="button" className="btn" onClick={cancelEdit}>
                      取消
                    </button>
                  </div>
                </form>
              ) : (
                <div className="engine-row">
                  <div className="engine-row__info">
                    <span className="engine-row__name">
                      {engine.name}
                      {engine.id === activeId && <span className="engine-row__badge">默认</span>}
                    </span>
                    <span className="engine-row__meta">
                      {engine.keyword ? `关键词 ${engine.keyword}` : '无关键词'} ·{' '}
                      {engine.searchUrlTemplate}
                    </span>
                  </div>
                  <div className="engine-row__actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`上移 ${engine.name}`}
                      disabled={index === 0}
                      onClick={() => moveEngine(engine.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`下移 ${engine.name}`}
                      disabled={index === engines.length - 1}
                      onClick={() => moveEngine(engine.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => startEdit(engine)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost engine-row__delete"
                      disabled={engines.length <= 1}
                      title={engines.length <= 1 ? '至少保留一个搜索引擎' : undefined}
                      onClick={() => removeEngine(engine.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {warning && (
        <p className="field__warning" role="status">
          {warning}
        </p>
      )}

      <div className="engine-add">
        <span className="field__label">快速添加</span>
        <div className="engine-add__presets">
          {availablePresets.length > 0 ? (
            availablePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="btn btn--ghost"
                onClick={() => addPreset(preset)}
              >
                添加 {preset.name}
              </button>
            ))
          ) : (
            <span className="field__help">预设引擎均已添加</span>
          )}
          <button type="button" className="btn btn--ghost" disabled={editingId !== null} onClick={addCustom}>
            自定义引擎
          </button>
        </div>
        <p className="field__help">列表第一个为默认引擎；删除默认引擎时自动改用新的第一项。</p>
      </div>
    </div>
  )
}
