import { describe, expect, it, vi, afterEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

afterEach(() => {
  vi.useRealTimers()
})

function at(minutesAgo: number): string {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  return new Date(Date.now() - minutesAgo * 60000).toISOString()
}

describe('formatRelativeTime', () => {
  it('分钟以内说刚刚', () => {
    expect(formatRelativeTime(at(0))).toBe('刚刚')
  })

  it('一小时内按分钟', () => {
    expect(formatRelativeTime(at(13))).toBe('13 分钟前')
  })

  it('一天内按小时', () => {
    expect(formatRelativeTime(at(60 * 5))).toBe('5 小时前')
  })

  it('超过一天按天', () => {
    expect(formatRelativeTime(at(60 * 24 * 3))).toBe('3 天前')
  })

  it('空值不输出 NaN', () => {
    expect(formatRelativeTime('')).toBe('')
  })
})
