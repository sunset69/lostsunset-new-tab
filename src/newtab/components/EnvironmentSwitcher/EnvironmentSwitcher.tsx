import type { Environment } from '../../../shared/models/config'
import './EnvironmentSwitcher.css'

type EnvironmentSwitcherProps = {
  environments: Environment[]
  activeId: string
  onSelect: (environmentId: string) => void
}

/**
 * 环境切换器（设计文档 3.2）。
 * 使用原生 select 以保留键盘与读屏行为，外层做 chip 视觉。
 */
export default function EnvironmentSwitcher({
  environments,
  activeId,
  onSelect,
}: EnvironmentSwitcherProps) {
  const active = environments.find((env) => env.id === activeId)

  return (
    <label className="env-switcher">
      <span
        className="env-switcher__dot"
        style={{ backgroundColor: active?.color ?? '#38bdf8' }}
        aria-hidden="true"
      />
      <span className="visually-hidden">当前环境</span>
      <select
        className="env-switcher__select"
        value={activeId}
        onChange={(event) => onSelect(event.target.value)}
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
    </label>
  )
}
