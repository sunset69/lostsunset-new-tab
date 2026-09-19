import { useState } from 'react'
import { useConfig } from '../../config/config-context'
import { buildSearchUrl } from '../../../shared/utils/url-search'

/** 搜索引擎设置（设计文档 2.1.2；阶段二重构为列表 CRUD）。 */
export default function SearchEngineSection() {
  const { config, updateConfig } = useConfig()
  const settings = config!.settings
  const engine =
    settings.searchEngines.find((item) => item.id === settings.activeSearchEngineId) ??
    settings.searchEngines[0]

  const [name, setName] = useState(engine.name)
  const [template, setTemplate] = useState(engine.searchUrlTemplate)
  const [error, setError] = useState<string | null>(null)

  const dirty = name !== engine.name || template !== engine.searchUrlTemplate

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('引擎名称不能为空')
      return
    }
    if (buildSearchUrl(template, '测试') === null) {
      setError('搜索地址不合法，且必须包含 {{query}} 占位符')
      return
    }
    setError(null)
    void updateConfig((draft) => {
      const target = draft.settings.searchEngines.find((item) => item.id === engine.id)
      if (target) {
        target.name = name.trim()
        target.searchUrlTemplate = template.trim()
      }
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="search-engine-name">
          引擎名称
        </label>
        <input
          id="search-engine-name"
          className="field__input"
          type="text"
          value={name}
          maxLength={32}
          required
          aria-invalid={error !== null}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="search-engine-template">
          搜索地址
        </label>
        <input
          id="search-engine-template"
          className="field__input field__input--mono"
          type="url"
          inputMode="url"
          spellCheck={false}
          value={template}
          required
          aria-describedby="search-engine-help"
          aria-invalid={error !== null}
          onChange={(event) => setTemplate(event.target.value)}
        />
        <p className="field__help" id="search-engine-help">
          例如 https://www.bing.com/search?q={'{{query}}'}
        </p>
        {error && <p className="field__error">{error}</p>}
      </div>

      <button type="submit" className="btn btn--primary" disabled={!dirty}>
        保存搜索引擎
      </button>
    </form>
  )
}
