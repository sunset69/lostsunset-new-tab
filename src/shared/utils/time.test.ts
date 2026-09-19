import { describe, expect, it } from 'vitest'
import { formatClock, formatDateChinese, getGreeting, pad2 } from './time'

describe('pad2', () => {
  it('个位数补零', () => {
    expect(pad2(0)).toBe('00')
    expect(pad2(9)).toBe('09')
  })

  it('两位数保持不变', () => {
    expect(pad2(12)).toBe('12')
    expect(pad2(59)).toBe('59')
  })
})

describe('formatClock', () => {
  it('格式化为 HH:MM', () => {
    expect(formatClock(new Date(2026, 8, 18, 21, 8))).toBe('21:08')
    expect(formatClock(new Date(2026, 8, 18, 5, 3))).toBe('05:03')
  })
})

describe('getGreeting', () => {
  it('按小时返回正确问候语', () => {
    expect(getGreeting(new Date(2026, 8, 18, 0))).toBe('夜深了')
    expect(getGreeting(new Date(2026, 8, 18, 5))).toBe('夜深了')
    expect(getGreeting(new Date(2026, 8, 18, 6))).toBe('早上好')
    expect(getGreeting(new Date(2026, 8, 18, 11))).toBe('早上好')
    expect(getGreeting(new Date(2026, 8, 18, 12))).toBe('中午好')
    expect(getGreeting(new Date(2026, 8, 18, 14))).toBe('下午好')
    expect(getGreeting(new Date(2026, 8, 18, 18))).toBe('晚上好')
    expect(getGreeting(new Date(2026, 8, 18, 23))).toBe('晚上好')
  })
})

describe('formatDateChinese', () => {
  it('格式化为中文日期与星期', () => {
    // 2026-09-18 是星期五
    expect(formatDateChinese(new Date(2026, 8, 18))).toBe('9月18日 星期五')
  })
})
