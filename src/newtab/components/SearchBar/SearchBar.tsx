import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SearchEngine } from '../../../shared/models/config'
import { buildSearchUrl } from '../../../shared/utils/url-search'
import { findKeywordHint, matchEngineKeyword } from '../../../shared/utils/search-input'
import './SearchBar.css'

export type SearchBarProps = {
  engines: SearchEngine[]
  activeEngineId: string
  /** 从下拉列表选择引擎（持久化 activeSearchEngineId）。 */
  onChangeEngine: (id: string) => void
  /** 打开设置抽屉的搜索引擎管理。 */
  onManageEngines?: () => void
  /** 跳转函数，默认当前标签页导航；抽成 prop 便于测试。 */
  onNavigate?: (url: string) => void
}

const defaultNavigate = (url: string): void => {
  window.location.assign(url)
}

/**
 * 底部 Dock 中的搜索框（设计文档 2.1.2；0001 改善 4/5）。
 * 左端引擎徽标可切换默认引擎；输入「keyword + 空格」临时切换引擎，
 * 提交后恢复默认；原生 form 提交保证中文输入法组词期间回车不误提交。
 *
 * 状态语义（002 问题 1 修复）：临时引擎只由一个稳定 id 表达——
 * 输入框被清空时立即复位为默认引擎；keyword 可以连续切换到任意非当前引擎，
 * 不会出现「切换一次后锁死」的状态。
 */
export default function SearchBar({
  engines,
  activeEngineId,
  onChangeEngine,
  onManageEngines,
  onNavigate = defaultNavigate,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [overrideEngineId, setOverrideEngineId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const activeEngine = engines.find((engine) => engine.id === activeEngineId) ?? engines[0]
  // 临时引擎若已从列表中删除（设置中删引擎），自然回退默认引擎。
  const overrideEngine =
    overrideEngineId !== null
      ? (engines.find((engine) => engine.id === overrideEngineId) ?? null)
      : null
  const effectiveEngine = overrideEngine ?? activeEngine
  const keywordCandidates = engines.filter((engine) => engine.id !== effectiveEngine.id)

  // 点击组件外部关闭引擎菜单。
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  function handleInputChange(value: string) {
    // 清空输入：解除临时引擎，徽标回到默认引擎（明确的逃生路径）。
    if (value === '') {
      setQuery('')
      setOverrideEngineId(null)
      return
    }

    // 每次按键都基于「当前生效引擎」计算候选，keyword 可连续切换。
    const match = matchEngineKeyword(value, keywordCandidates)
    if (match) {
      // 命中默认引擎时直接复位，而不是再挂一个等价的临时态。
      setOverrideEngineId(match.engine.id === activeEngine.id ? null : match.engine.id)
      setQuery(match.rest)
      return
    }
    setQuery(value)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!effectiveEngine) return
    const url = buildSearchUrl(effectiveEngine.searchUrlTemplate, query)
    if (!url) return
    setOverrideEngineId(null)
    onNavigate(url)
  }

  function selectEngine(id: string) {
    setMenuOpen(false)
    setOverrideEngineId(null)
    onChangeEngine(id)
  }

  const hintEngine = findKeywordHint(query, keywordCandidates)
  const badgeLabel = effectiveEngine
    ? `切换搜索引擎（当前：${effectiveEngine.name}${overrideEngine ? '·临时' : ''}）`
    : '切换搜索引擎'

  return (
    <div className="search-bar" ref={rootRef}>
      <form className="search-bar__form" role="search" onSubmit={handleSubmit}>
        {effectiveEngine && (
          <button
            type="button"
            className={`search-bar__engine${overrideEngine ? ' search-bar__engine--temp' : ''}`}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label={badgeLabel}
            title={
              overrideEngine
                ? `临时使用 ${effectiveEngine.name} 搜索，提交或清空输入后恢复 ${activeEngine?.name ?? ''}`
                : badgeLabel
            }
            onClick={() => setMenuOpen((open) => !open)}
          >
            {overrideEngine && (
              <span className="search-bar__engine-dot" aria-hidden="true" />
            )}
            <span className="search-bar__engine-name">{effectiveEngine.name}</span>
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="m6 9 6 6 6-6H6Z" fill="currentColor" />
            </svg>
          </button>
        )}
        <label className="visually-hidden" htmlFor="search-bar-input">
          搜索关键词
        </label>
        <input
          id="search-bar-input"
          className="search-bar__input"
          name="q"
          type="text"
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder={effectiveEngine ? `使用 ${effectiveEngine.name} 搜索` : '搜索'}
          autoComplete="off"
          autoFocus
          spellCheck={false}
          enterKeyHint="search"
          maxLength={2048}
          aria-describedby={hintEngine ? 'search-bar-hint' : undefined}
        />
        <button className="search-bar__submit" type="submit" aria-label={`使用${effectiveEngine?.name ?? ''}搜索`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path
              d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
              fill="currentColor"
            />
            <path d="m15.2 14.1 5.1 5.1-1.4 1.4-5.1-5.1z" fill="currentColor" />
          </svg>
        </button>
        {hintEngine && (
          <span className="search-bar__hint" id="search-bar-hint" role="status">
            空格使用 {hintEngine.name} 搜索
          </span>
        )}
      </form>

      {menuOpen && (
        <ul className="search-bar__menu" role="listbox" aria-label="选择搜索引擎">
          {engines.map((engine) => (
            <li key={engine.id}>
              <button
                type="button"
                role="option"
                aria-selected={engine.id === effectiveEngine.id}
                className={`search-bar__option${engine.id === effectiveEngine.id ? ' search-bar__option--active' : ''}`}
                onClick={() => selectEngine(engine.id)}
              >
                <span className="search-bar__option-name">{engine.name}</span>
                {engine.keyword && <span className="search-bar__option-keyword">{engine.keyword}</span>}
              </button>
            </li>
          ))}
          {onManageEngines && (
            <li>
              <button
                type="button"
                className="search-bar__manage"
                onClick={() => {
                  setMenuOpen(false)
                  onManageEngines()
                }}
              >
                管理搜索引擎…
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
