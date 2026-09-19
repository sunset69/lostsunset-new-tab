import { type FormEvent, useId, useState } from 'react'
import type { SearchEngine } from '../../../shared/models/config'
import { buildSearchUrl } from '../../../shared/utils/url-search'
import './SearchBar.css'

export type SearchBarProps = {
  engine: SearchEngine
  /** 跳转函数，默认当前标签页导航；抽成 prop 便于测试与后续扩展。 */
  onNavigate?: (url: string) => void
}

const defaultNavigate = (url: string): void => {
  window.location.assign(url)
}

/**
 * 底部 Dock 中的搜索框（设计文档 2.1.2）。
 * 使用原生 form 提交，浏览器会自动保证中文输入法组词期间回车不会误提交。
 */
export default function SearchBar({ engine, onNavigate = defaultNavigate }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const inputId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const url = buildSearchUrl(engine.searchUrlTemplate, query)
    if (!url) return
    onNavigate(url)
  }

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={inputId}>
        搜索关键词
      </label>
      <input
        id={inputId}
        className="search-bar__input"
        name="q"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`使用 ${engine.name} 搜索`}
        autoComplete="off"
        autoFocus
        spellCheck={false}
        enterKeyHint="search"
        maxLength={2048}
      />
      <button className="search-bar__submit" type="submit" aria-label={`使用${engine.name}搜索`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
            fill="currentColor"
          />
          <path d="m15.2 14.1 5.1 5.1-1.4 1.4-5.1-5.1z" fill="currentColor" />
        </svg>
      </button>
    </form>
  )
}
