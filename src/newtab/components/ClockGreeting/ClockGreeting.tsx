import { useNow } from '../../hooks/useNow'
import { useConfig } from '../../config/config-context'
import { DEFAULT_CLOCK_POSITION } from '../../../shared/config/default-config'
import { formatClock, formatDateChinese, getGreeting } from '../../../shared/utils/time'
import './ClockGreeting.css'

/** 时钟、日期与时段问候语；位置可在设置「外观」中配置（0004 改善 3，缺省左下）。 */
export default function ClockGreeting() {
  const now = useNow()
  const clock = formatClock(now)
  const { config } = useConfig()
  const position = config?.settings.clock?.position ?? DEFAULT_CLOCK_POSITION

  return (
    <section
      className={`clock-block clock-block--${position}`}
      aria-label={`当前时间 ${clock}`}
    >
      <time className="clock-block__time" dateTime={now.toISOString()}>
        {clock}
      </time>
      <p className="clock-block__meta">
        {formatDateChinese(now)} · {getGreeting(now)}
      </p>
    </section>
  )
}
