import { useNow } from '../../hooks/useNow'
import { formatClock, formatDateChinese, getGreeting } from '../../../shared/utils/time'
import './ClockGreeting.css'

/** 左下时钟、日期与时段问候语（设计文档 3.2）。 */
export default function ClockGreeting() {
  const now = useNow()
  const clock = formatClock(now)

  return (
    <section className="clock-block" aria-label={`当前时间 ${clock}`}>
      <time className="clock-block__time" dateTime={now.toISOString()}>
        {clock}
      </time>
      <p className="clock-block__meta">
        {formatDateChinese(now)} · {getGreeting(now)}
      </p>
    </section>
  )
}
