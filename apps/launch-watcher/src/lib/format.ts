import type { WeatherRisk } from '@aperture/orbital-core'

const utcDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const utcTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const utcDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const localDateTime = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

export const fmt = {
  utcDateTime: (d: Date) => `${utcDateTime.format(d)} UTC`,
  utcTime: (d: Date) => `${utcTime.format(d)} UTC`,
  utcDate: (d: Date) => utcDate.format(d),
  local: (d: Date) => localDateTime.format(d),
  deg: (v: number, digits = 1) => `${v.toFixed(digits)}°`,
  /** Angle in [0, 360) that never prints as "360.0°" after rounding */
  angle: (v: number, digits = 1) => {
    const r = Number((((v % 360) + 360) % 360).toFixed(digits))
    return `${(r >= 360 ? 0 : r).toFixed(digits)}°`
  },
  km: (v: number) => `${Math.round(v).toLocaleString()} km`,
  pct: (v: number) => `${Math.round(v * 100)}%`,
  lat: (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'N' : 'S'}`,
  lon: (v: number) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? 'E' : 'W'}`,
  /** Seconds → "4m 30s" / "1h 05m" */
  duration: (sec: number) => {
    const s = Math.round(Math.abs(sec))
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
  },
  /** Mission-elapsed style: T−02:14:05 / T+00:00:12 */
  tMinus: (ms: number) => {
    const sign = ms > 0 ? 'T−' : 'T+'
    const total = Math.floor(Math.abs(ms) / 1000)
    const d = Math.floor(total / 86400)
    const h = Math.floor((total % 86400) / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const hms = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
    return `${sign}${d > 0 ? `${d}d ` : ''}${hms}`
  },
}

export const RISK_META: Record<WeatherRisk, { label: string; short: string; color: string; text: string; bg: string; ring: string }> = {
  low: { label: 'Go for launch', short: 'GO', color: '#22c55e', text: 'text-go', bg: 'bg-go/10', ring: 'ring-go/30' },
  medium: { label: 'Weather watch', short: 'WATCH', color: '#f59e0b', text: 'text-watch', bg: 'bg-watch/10', ring: 'ring-watch/30' },
  high: { label: 'No-go conditions', short: 'NO-GO', color: '#ef4444', text: 'text-nogo', bg: 'bg-nogo/10', ring: 'ring-nogo/30' },
}

/** YYYY-MM-DD for a Date in UTC */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}
