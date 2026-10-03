/**
 * Civil time in an IANA time zone (e.g. "America/Halifax"), via Intl — DST aware,
 * no time zone database bundled.
 */

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

/** Offset of the zone from UTC at an instant (ms; negative west of Greenwich) */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = partsFormatter(timeZone).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** The instant of a wall-clock time ("HH:MM") on a calendar date ("YYYY-MM-DD") in a zone */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  // Two passes settle the offset when the date straddles a DST change
  let t = wall - timeZoneOffsetMs(new Date(wall), timeZone)
  t = wall - timeZoneOffsetMs(new Date(t), timeZone)
  return new Date(t)
}

/** Calendar date ("YYYY-MM-DD") of an instant in a zone */
export function zonedDate(date: Date, timeZone: string): string {
  return new Date(date.getTime() + timeZoneOffsetMs(date, timeZone)).toISOString().slice(0, 10)
}

/** The calendar date `days` after a "YYYY-MM-DD" date */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}
