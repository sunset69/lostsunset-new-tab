import { useConfig } from '../../config/config-context'
import { DEFAULT_CLOCK_POSITION } from '../../../shared/config/default-config'
import type { ClockPosition } from '../../../shared/models/config'

/** 外观设置（0004 改善 3）：时钟在主画面上的九宫格位置。 */

type Pos = {
  value: ClockPosition
  label: string
  /** 迷你预览中小圆点的横向/纵向对齐。 */
  justify: 'flex-start' | 'center' | 'flex-end'
  align: 'flex-start' | 'center' | 'flex-end'
}

const POSITIONS: Pos[] = [
  { value: 'top-left', label: '左上', justify: 'flex-start', align: 'flex-start' },
  { value: 'top-center', label: '上中', justify: 'center', align: 'flex-start' },
  { value: 'top-right', label: '右上', justify: 'flex-end', align: 'flex-start' },
  { value: 'middle-left', label: '左中', justify: 'flex-start', align: 'center' },
  { value: 'middle-center', label: '居中', justify: 'center', align: 'center' },
  { value: 'middle-right', label: '右中', justify: 'flex-end', align: 'center' },
  { value: 'bottom-left', label: '左下', justify: 'flex-start', align: 'flex-end' },
  { value: 'bottom-center', label: '下中', justify: 'center', align: 'flex-end' },
  { value: 'bottom-right', label: '右下', justify: 'flex-end', align: 'flex-end' },
]

export default function AppearanceSection() {
  const { config, updateConfig } = useConfig()
  const position = config!.settings.clock?.position ?? DEFAULT_CLOCK_POSITION

  function choose(next: ClockPosition) {
    void updateConfig((draft) => {
      draft.settings.clock = { position: next }
    })
  }

  return (
    <div className="appearance-settings">
      <span className="field__label" id="clock-position-label">
        时钟位置
      </span>
      <div
        className="clock-position-grid"
        role="radiogroup"
        aria-labelledby="clock-position-label"
      >
        {POSITIONS.map((pos) => {
          const active = position === pos.value
          return (
            <button
              key={pos.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`clock-position__cell${active ? ' clock-position__cell--active' : ''}`}
              style={{ justifyContent: pos.justify, alignItems: pos.align }}
              aria-label={`时钟位置：${pos.label}`}
              title={`时钟显示在画面${pos.label}`}
              onClick={() => choose(pos.value)}
            >
              <span className="clock-position__dot" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <p className="field__help">选择时间、日期与问候语在起始页上的显示位置，默认左下。</p>
    </div>
  )
}
