/**
 * 本地时间与问候语工具（设计文档 2.1.1）。
 * 全部为纯函数，使用浏览器本地时区，不做网络时间校准。
 */

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** 格式化为 HH:MM。 */
export function formatClock(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 按小时返回时段问候语。 */
export function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 格式化为“M月D日 星期X”。 */
export function formatDateChinese(date: Date): string {
  const week = WEEK_LABELS[date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 星期${week}`
}
