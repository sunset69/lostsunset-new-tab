import { useState } from 'react'
import { useConfig } from '../../config/config-context'
import type { Environment } from '../../../shared/models/config'
import { createId } from '../../../shared/utils/id'
import { isValidVariableName } from '../../../shared/services/environment-resolver'

type VariableRow = { key: string; value: string }

type FormState = {
  id: string | null
  name: string
  color: string
  rows: VariableRow[]
}

function toRows(variables: Record<string, string>): VariableRow[] {
  const entries = Object.entries(variables)
  const rows = entries.map(([key, value]) => ({ key, value }))
  return rows.length > 0 ? rows : [{ key: '', value: '' }]
}

/** 环境管理（设计文档 2.1.3 / 3.3）：列表 + 新增/编辑/删除 + 变量编辑。 */
export default function EnvironmentSection() {
  const { config, updateConfig } = useConfig()
  const environments = config!.environments
  const activeId = config!.settings.activeEnvironmentId

  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function startCreate() {
    setConfirmDeleteId(null)
    setError(null)
    setForm({ id: null, name: '', color: '#38bdf8', rows: [{ key: '', value: '' }] })
  }

  function startEdit(environment: Environment) {
    setConfirmDeleteId(null)
    setError(null)
    setForm({
      id: environment.id,
      name: environment.name,
      color: environment.color ?? '#38bdf8',
      rows: toRows(environment.variables),
    })
  }

  function updateRow(index: number, patch: Partial<VariableRow>) {
    setForm((current) => {
      if (!current) return current
      const rows = current.rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
      return { ...current, rows }
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form) return

    const name = form.name.trim()
    if (!name) {
      setError('环境名称不能为空')
      return
    }

    const variables: Record<string, string> = {}
    for (const row of form.rows) {
      const key = row.key.trim()
      const value = row.value.trim()
      if (!key && !value) continue
      if (!key) {
        setError('变量名不能为空')
        return
      }
      if (!isValidVariableName(key)) {
        setError(`变量名「${key}」不合法：字母/下划线开头，仅含字母数字下划线`)
        return
      }
      if (key in variables) {
        setError(`变量名「${key}」重复`)
        return
      }
      variables[key] = value
    }

    const id = form.id ?? createId('env')
    const environment: Environment = { id, name, color: form.color, variables }

    void updateConfig((draft) => {
      const index = draft.environments.findIndex((item) => item.id === id)
      if (index >= 0) {
        draft.environments[index] = environment
      } else {
        draft.environments.push(environment)
      }
    })
    setForm(null)
    setError(null)
  }

  function handleDelete(environmentId: string) {
    void updateConfig((draft) => {
      draft.environments = draft.environments.filter((item) => item.id !== environmentId)
    })
    setConfirmDeleteId(null)
  }

  return (
    <div>
      <ul className="item-list">
        {environments.map((environment) => {
          const isActive = environment.id === activeId
          return (
            <li key={environment.id} className="item-list__row">
              <span
                className="item-list__dot"
                style={{ backgroundColor: environment.color ?? '#38bdf8' }}
                aria-hidden="true"
              />
              <span className="item-list__name">{environment.name}</span>
              {isActive && <span className="badge">使用中</span>}
              <span className="item-list__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => startEdit(environment)}
                >
                  编辑
                </button>
                {isActive ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled
                    title="请先切换到其他环境后再删除"
                  >
                    删除
                  </button>
                ) : confirmDeleteId === environment.id ? (
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => handleDelete(environment.id)}
                  >
                    确认删除？
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setConfirmDeleteId(environment.id)}
                  >
                    删除
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {!form && (
        <button type="button" className="btn btn--ghost" onClick={startCreate}>
          添加环境
        </button>
      )}

      {form && (
        <form className="form form--inline" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor={`env-name-${form.id ?? 'new'}`}>
              环境名称
            </label>
            <input
              id={`env-name-${form.id ?? 'new'}`}
              className="field__input"
              type="text"
              value={form.name}
              maxLength={32}
              required
              autoFocus
              aria-invalid={error !== null}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <div className="field">
            <span className="field__label">环境变量</span>
            <div className="var-editor">
              {form.rows.map((row, index) => (
                <div className="var-editor__row" key={index}>
                  <input
                    className="field__input field__input--mono var-editor__key"
                    type="text"
                    aria-label={`变量名 ${index + 1}`}
                    placeholder="变量名，如 baseUrl"
                    value={row.key}
                    spellCheck={false}
                    onChange={(event) => updateRow(index, { key: event.target.value })}
                  />
                  <input
                    className="field__input var-editor__value"
                    type="text"
                    aria-label={`变量值 ${index + 1}`}
                    placeholder="值，如 http://192.168.1.10:8080"
                    value={row.value}
                    spellCheck={false}
                    onChange={(event) => updateRow(index, { value: event.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    aria-label="删除该变量"
                    onClick={() =>
                      setForm({
                        ...form,
                        rows:
                          form.rows.length === 1
                            ? [{ key: '', value: '' }]
                            : form.rows.filter((_, i) => i !== index),
                      })
                    }
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm({ ...form, rows: [...form.rows, { key: '', value: '' }] })}
              >
                添加变量
              </button>
            </div>
          </div>

          {error && <p className="field__error">{error}</p>}

          <div className="form__actions">
            <button type="submit" className="btn btn--primary">
              保存环境
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
