import { describe, expect, test } from 'bun:test'
import { clampSpanDays, clampStartDate, maxSpanDays, searchDateLimits, startDateOrToday } from '../src/lib/searchRange'

const TZ = 'America/Halifax'
// 15:00 ADT on Sat 3 Oct 2026
const NOW = new Date('2026-10-03T18:00:00Z')

describe('search date limits (Halifax calendar, 16-day forecast)', () => {
  test('a past date clamps to today', () => {
    expect(startDateOrToday('2026-09-20', NOW, TZ)).toBe('2026-10-03')
    expect(clampStartDate('2026-09-20', NOW, TZ)).toBe('') // stored as '' = today, follows the clock
  })

  test('today + 20 clamps to today + 16', () => {
    expect(startDateOrToday('2026-10-23', NOW, TZ)).toBe('2026-10-19')
    expect(clampStartDate('2026-10-23', NOW, TZ)).toBe('2026-10-19')
    expect(clampStartDate('2026-10-10', NOW, TZ)).toBe('2026-10-10') // in range: unchanged
  })

  test('start today + 10 with a 14-day span gives a 6-day span', () => {
    expect(clampSpanDays('2026-10-13', 14, NOW, TZ)).toBe(6)
    expect(clampSpanDays('', 14, NOW, TZ)).toBe(14)
    expect(clampSpanDays('', 60, NOW, TZ)).toBe(16)
    expect(maxSpanDays('2026-10-19', NOW, TZ)).toBe(1) // never below one day
  })

  test('uses the Halifax date near midnight UTC', () => {
    const lateEvening = new Date('2026-10-04T02:00:00Z') // 23:00 ADT, Sat 3 Oct
    expect(searchDateLimits(lateEvening, TZ)).toEqual({ today: '2026-10-03', last: '2026-10-19' })
    expect(startDateOrToday('2026-10-02', lateEvening, TZ)).toBe('2026-10-03')
    expect(clampStartDate('2026-10-04', lateEvening, TZ)).toBe('2026-10-04') // tomorrow in Halifax, not "today"
  })
})
