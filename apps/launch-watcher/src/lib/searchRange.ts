/**
 * Search date limits. Searches stay inside the weather forecast: the start date is
 * between today and today + 16 days, and start + span never goes past today + 16.
 * "Today" is the launch site's calendar date. Pure functions, so the store, the plan
 * and tests share them.
 */
import { addDays, zonedDate } from '@aperture/orbital-core'

/** Length of the Open-Meteo forecast (days) — also the furthest a search may reach */
export const SEARCH_LIMIT_DAYS = 16

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Today and the last allowed date (YYYY-MM-DD) in the site's time zone */
export function searchDateLimits(now: Date, timeZone: string): { today: string; last: string } {
  const today = zonedDate(now, timeZone)
  return { today, last: addDays(today, SEARCH_LIMIT_DAYS) }
}

/** The start date to use (YYYY-MM-DD): '' or past → today, beyond the limit → today + 16 */
export function startDateOrToday(startDate: string, now: Date, timeZone: string): string {
  const { today, last } = searchDateLimits(now, timeZone)
  if (!ISO_DATE.test(startDate) || Number.isNaN(Date.parse(startDate)) || startDate < today) return today
  return startDate > last ? last : startDate
}

/** Stored form of the clamped start date: '' when it is today, so it keeps following the clock */
export function clampStartDate(startDate: string, now: Date, timeZone: string): string {
  const date = startDateOrToday(startDate, now, timeZone)
  return date === searchDateLimits(now, timeZone).today ? '' : date
}

/** Longest span (days, at least 1) that keeps start + span within today + 16 */
export function maxSpanDays(startDate: string, now: Date, timeZone: string): number {
  return Math.max(1, daysBetween(startDateOrToday(startDate, now, timeZone), searchDateLimits(now, timeZone).last))
}

/** Span clamped to 1 … maxSpanDays */
export function clampSpanDays(startDate: string, spanDays: number, now: Date, timeZone: string): number {
  const span = Number.isFinite(spanDays) ? Math.round(spanDays) : SEARCH_LIMIT_DAYS
  return Math.min(Math.max(1, span), maxSpanDays(startDate, now, timeZone))
}
