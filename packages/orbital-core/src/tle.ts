/**
 * NORAD two-line element sets: parsing with full validation, formatting with
 * checksums, and conversion between TLE (Kozai) mean motion and Brouwer mean
 * semi-major axis used by the engine.
 *
 * Format reference: https://celestrak.org/columns/v04n03/
 */
import { WGS72, MINUTES_PER_DAY, MS_PER_DAY } from './constants'
import { normalizeAngle } from './math'
import type { OrbitalElements } from './types'

export interface Tle {
  name?: string
  catalogNumber: string
  /** U = unclassified, C, S */
  classification: string
  /** International designator, e.g. "13009C" */
  intlDesignator: string
  epoch: Date
  /** First derivative of mean motion ÷ 2 (rev/day²) */
  meanMotionDot: number
  /** Second derivative of mean motion ÷ 6 (rev/day³) */
  meanMotionDdot: number
  /** Drag term (1/Earth radii) */
  bstar: number
  ephemerisType: number
  elementSetNumber: number
  /** deg */
  inclination: number
  /** deg */
  raan: number
  eccentricity: number
  /** deg */
  argOfPerigee: number
  /** deg */
  meanAnomaly: number
  /** Kozai mean motion (rev/day) */
  meanMotion: number
  revolutionNumber: number
}

export type TleParseResult = { ok: true; tle: Tle; lines: [string, string] } | { ok: false; errors: string[] }

/** Modulo-10 checksum of the first 68 characters (digits count their value, '-' counts 1) */
export function tleChecksum(line: string): number {
  let sum = 0
  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') sum += ch.charCodeAt(0) - 48
    else if (ch === '-') sum += 1
  }
  return sum % 10
}

/** " 10395-3" → 0.10395e-3 ; "-78837-5" → −0.78837e-5 */
function parseExponential(field: string): number {
  const s = field.trim()
  if (s === '' || /^[+-]?0+[+-]0$/.test(s)) return 0
  const m = /^([+-]?)(\d{1,5})([+-])(\d)$/.exec(s)
  if (!m) return Number.NaN
  const mantissa = Number(`0.${m[2]!.padStart(5, '0')}`)
  return (m[1] === '-' ? -1 : 1) * mantissa * 10 ** (Number(m[4]) * (m[3] === '-' ? -1 : 1))
}

/** 0.00010395 → " 10395-3" */
function formatExponential(value: number): string {
  if (!Number.isFinite(value) || value === 0) return ' 00000+0'
  const sign = value < 0 ? '-' : ' '
  let exp = Math.floor(Math.log10(Math.abs(value))) + 1
  let mantissa = Math.round((Math.abs(value) / 10 ** exp) * 1e5)
  if (mantissa >= 1e5) {
    mantissa = Math.round(mantissa / 10)
    exp += 1
  }
  if (exp > 9 || exp < -9) return ' 00000+0'
  return `${sign}${String(mantissa).padStart(5, '0')}${exp < 0 ? '-' : '+'}${Math.abs(exp)}`
}

function parseEpoch(field: string): Date {
  const yy = Number(field.slice(0, 2))
  const doy = Number(field.slice(2))
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  // Round (not truncate) to the millisecond so formatting recovers the 8-decimal day exactly
  return new Date(Math.round(Date.UTC(year, 0, 1) + (doy - 1) * MS_PER_DAY))
}

function formatEpoch(date: Date): string {
  const year = date.getUTCFullYear()
  let doy = (date.getTime() - Date.UTC(year, 0, 1)) / MS_PER_DAY + 1
  doy = Math.round(doy * 1e8) / 1e8
  return `${String(year % 100).padStart(2, '0')}${doy.toFixed(8).padStart(12, '0')}`
}

/**
 * Parse a TLE from text: two lines, optionally preceded by a name line ("0 NAME" or "NAME").
 * Validates length, line numbers, matching catalog numbers, checksums and value ranges.
 */
export function parseTle(text: string): TleParseResult {
  const raw = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '')
  const errors: string[] = []

  let name: string | undefined
  if (raw.length === 3) name = raw[0]!.replace(/^0\s+/, '').trim()
  else if (raw.length !== 2) return { ok: false, errors: ['Expected two element lines, optionally preceded by a name line.'] }

  const l1 = raw[raw.length - 2]!
  const l2 = raw[raw.length - 1]!

  for (const [no, line] of [
    [1, l1],
    [2, l2],
  ] as const) {
    if (line.length !== 69) errors.push(`Line ${no} has ${line.length} characters; a TLE line is exactly 69.`)
    if (line[0] !== String(no)) errors.push(`Line ${no} must start with "${no}".`)
    if (line.length === 69) {
      const expected = tleChecksum(line)
      if (Number(line[68]) !== expected || !/\d/.test(line[68]!)) {
        errors.push(`Line ${no} checksum is "${line[68]}", expected ${expected}.`)
      }
    }
  }
  if (errors.length) return { ok: false, errors }

  const catalog1 = l1.slice(2, 7).trim()
  const catalog2 = l2.slice(2, 7).trim()
  if (catalog1 !== catalog2) errors.push(`Catalog numbers differ between lines (${catalog1} vs ${catalog2}).`)

  const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s))
  const tle: Tle = {
    name: name || undefined,
    catalogNumber: catalog1,
    classification: l1[7]!.trim() || 'U',
    intlDesignator: l1.slice(9, 17).trim(),
    epoch: parseEpoch(l1.slice(18, 32)),
    meanMotionDot: num(l1.slice(33, 43).replace(/^([ +-]?)\./, '$10.')),
    meanMotionDdot: parseExponential(l1.slice(44, 52)),
    bstar: parseExponential(l1.slice(53, 61)),
    ephemerisType: num(l1[62]!) || 0,
    elementSetNumber: num(l1.slice(64, 68)) || 0,
    inclination: num(l2.slice(8, 16)),
    raan: num(l2.slice(17, 25)),
    eccentricity: num(`0.${l2.slice(26, 33).trim()}`),
    argOfPerigee: num(l2.slice(34, 42)),
    meanAnomaly: num(l2.slice(43, 51)),
    meanMotion: num(l2.slice(52, 63)),
    revolutionNumber: num(l2.slice(63, 68)) || 0,
  }

  if (Number.isNaN(tle.epoch.getTime())) errors.push('Epoch (line 1, columns 19–32) is not a valid YYDDD.DDDDDDDD value.')
  const check = (ok: boolean, msg: string) => ok || errors.push(msg)
  check(Number.isFinite(tle.meanMotionDot), 'First derivative of mean motion (line 1, columns 34–43) is invalid.')
  check(Number.isFinite(tle.meanMotionDdot), 'Second derivative of mean motion (line 1, columns 45–52) is invalid.')
  check(Number.isFinite(tle.bstar), 'B* drag term (line 1, columns 54–61) is invalid.')
  check(tle.inclination >= 0 && tle.inclination <= 180, 'Inclination (line 2, columns 9–16) must be 0–180°.')
  check(tle.raan >= 0 && tle.raan < 360, 'RAAN (line 2, columns 18–25) must be 0–360°.')
  check(tle.eccentricity >= 0 && tle.eccentricity < 1, 'Eccentricity (line 2, columns 27–33) must be 0–0.9999999.')
  check(tle.argOfPerigee >= 0 && tle.argOfPerigee < 360, 'Argument of perigee (line 2, columns 35–42) must be 0–360°.')
  check(tle.meanAnomaly >= 0 && tle.meanAnomaly < 360, 'Mean anomaly (line 2, columns 44–51) must be 0–360°.')
  check(tle.meanMotion > 0 && tle.meanMotion < 20, 'Mean motion (line 2, columns 53–63) must be 0–20 rev/day.')
  if (errors.length) return { ok: false, errors }

  return { ok: true, tle, lines: [l1, l2] }
}

/** Format a TLE as its two element lines (with checksums) */
export function formatTle(tle: Tle): [string, string] {
  // Angles that round up to 360.0000 wrap to 0
  const f = (v: number, width: number, digits: number) => {
    const s = normalizeAngle(v).toFixed(digits)
    return (Number(s) >= 360 ? (0).toFixed(digits) : s).padStart(width, ' ')
  }
  const ndot = `${tle.meanMotionDot < 0 ? '-' : ' '}${Math.abs(tle.meanMotionDot).toFixed(8).replace(/^0/, '')}`
  const ecc = Math.round(tle.eccentricity * 1e7)
  const cat = tle.catalogNumber.slice(0, 5).padStart(5, '0')

  const body1 = [
    '1 ',
    cat,
    (tle.classification || 'U').slice(0, 1),
    ' ',
    tle.intlDesignator.slice(0, 8).padEnd(8, ' '),
    ' ',
    formatEpoch(tle.epoch),
    ' ',
    ndot,
    ' ',
    formatExponential(tle.meanMotionDdot),
    ' ',
    formatExponential(tle.bstar),
    ' ',
    String(tle.ephemerisType % 10),
    ' ',
    String(Math.round(tle.elementSetNumber) % 10000).padStart(4, ' '),
  ].join('')
  const body2 = [
    '2 ',
    cat,
    ' ',
    tle.inclination.toFixed(4).padStart(8, ' '),
    ' ',
    f(tle.raan, 8, 4),
    ' ',
    String(Math.min(ecc, 9_999_999)).padStart(7, '0'),
    ' ',
    f(tle.argOfPerigee, 8, 4),
    ' ',
    f(tle.meanAnomaly, 8, 4),
    ' ',
    tle.meanMotion.toFixed(8).padStart(11, ' '),
    String(Math.round(tle.revolutionNumber) % 100000).padStart(5, ' '),
  ].join('')

  return [`${body1}${tleChecksum(body1)}`, `${body2}${tleChecksum(body2)}`]
}

/** Three-line text (name line + two element lines) */
export function tleToText(tle: Tle): string {
  const [l1, l2] = formatTle(tle)
  return tle.name ? `${tle.name}\n${l1}\n${l2}` : `${l1}\n${l2}`
}

/**
 * Recover the Brouwer mean semi-major axis (km) from a TLE Kozai mean motion,
 * exactly as SGP4 initialisation does.
 */
export function kozaiToSemiMajorAxis(meanMotionRevDay: number, eccentricity: number, inclinationDeg: number): number {
  const { ke, j2, radiusKm } = WGS72
  const k2 = 0.5 * j2
  const n = (meanMotionRevDay * 2 * Math.PI) / MINUTES_PER_DAY // rad/min
  const cosI = Math.cos((inclinationDeg * Math.PI) / 180)
  const beta0 = Math.sqrt(1 - eccentricity * eccentricity)
  const x3thm1 = 3 * cosI * cosI - 1
  const a1 = (ke / n) ** (2 / 3)
  const d1 = (1.5 * k2 * x3thm1) / (a1 * a1 * beta0 ** 3)
  const a0 = a1 * (1 - d1 / 3 - d1 * d1 - (134 / 81) * d1 ** 3)
  const d0 = (1.5 * k2 * x3thm1) / (a0 * a0 * beta0 ** 3)
  return (a0 / (1 - d0)) * radiusKm
}

/** Inverse of `kozaiToSemiMajorAxis`: the TLE mean motion (rev/day) for a Brouwer semi-major axis */
export function semiMajorAxisToKozai(semiMajorAxisKm: number, eccentricity: number, inclinationDeg: number): number {
  // Keplerian guess, then fixed-point refinement (converges to < 1e-12 in a few steps)
  let n = (WGS72.ke / (semiMajorAxisKm / WGS72.radiusKm) ** 1.5) * (MINUTES_PER_DAY / (2 * Math.PI))
  for (let i = 0; i < 12; i++) {
    const a = kozaiToSemiMajorAxis(n, eccentricity, inclinationDeg)
    const next = n * (a / semiMajorAxisKm) ** 1.5
    if (Math.abs(next - n) < 1e-13) return next
    n = next
  }
  return n
}

/** Engine orbital elements from a TLE */
export function tleToElements(tle: Tle): OrbitalElements {
  return {
    epoch: tle.epoch,
    semiMajorAxis: kozaiToSemiMajorAxis(tle.meanMotion, tle.eccentricity, tle.inclination),
    eccentricity: tle.eccentricity,
    inclination: tle.inclination,
    raan: tle.raan,
    argOfPerigee: tle.argOfPerigee,
    meanAnomaly: tle.meanAnomaly,
  }
}

export type TleMetadata = Partial<Omit<Tle, keyof OrbitalElements | 'meanMotion'>>

/** Build a TLE from engine elements, keeping identification and drag fields from `meta` */
export function elementsToTle(el: OrbitalElements, meta: TleMetadata = {}): Tle {
  return {
    name: meta.name,
    catalogNumber: meta.catalogNumber ?? '99999',
    classification: meta.classification ?? 'U',
    intlDesignator: meta.intlDesignator ?? '',
    epoch: el.epoch,
    meanMotionDot: meta.meanMotionDot ?? 0,
    meanMotionDdot: meta.meanMotionDdot ?? 0,
    bstar: meta.bstar ?? 0,
    ephemerisType: meta.ephemerisType ?? 0,
    elementSetNumber: meta.elementSetNumber ?? 999,
    inclination: el.inclination,
    raan: normalizeAngle(el.raan),
    eccentricity: el.eccentricity,
    argOfPerigee: normalizeAngle(el.argOfPerigee),
    meanAnomaly: normalizeAngle(el.meanAnomaly),
    meanMotion: semiMajorAxisToKozai(el.semiMajorAxis, el.eccentricity, el.inclination),
    revolutionNumber: meta.revolutionNumber ?? 0,
  }
}

/** Parse text straight to elements; throws with all validation messages on failure */
export function orbitFromTle(text: string): OrbitalElements {
  const result = parseTle(text)
  if (!result.ok) throw new Error(`Invalid TLE: ${result.errors.join(' ')}`)
  return tleToElements(result.tle)
}

/** Age of a TLE epoch relative to `at` (days, positive = epoch in the past) */
export function tleAgeDays(epoch: Date, at: Date = new Date()): number {
  return (at.getTime() - epoch.getTime()) / MS_PER_DAY
}