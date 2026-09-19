import { useEffect, useState } from 'react'

/** 按固定间隔返回当前时间，默认每秒刷新（时钟组件使用）。 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
