import {
  EARTH_RADIUS_KM,
  SECONDS_PER_DAY,
  anomalisticPeriod,
  apogeeAltitude,
  classifyOrbit,
  ltanAt,
  perigeeAltitude,
  secularRates,
  tleAgeDays,
  visVivaSpeed,
  type OrbitClass,
  type OrbitalElements,
} from '@aperture/orbital-core'

export interface OrbitSummary {
  orbitClass: OrbitClass
  perigee: number
  apogee: number
  periodMin: number
  revsPerDay: number
  vPerigee: number
  vApogee: number
  raanRate: number
  argpRate: number
  ltan: number
  ageDays: number
}

export function summarizeOrbit(el: OrbitalElements, at: Date = new Date()): OrbitSummary {
  const period = anomalisticPeriod(el)
  const rates = secularRates(el)
  const rp = perigeeAltitude(el)
  const ra = apogeeAltitude(el)
  return {
    orbitClass: classifyOrbit(el),
    perigee: rp,
    apogee: ra,
    periodMin: period / 60,
    revsPerDay: SECONDS_PER_DAY / period,
    vPerigee: visVivaSpeed(el.semiMajorAxis, rp + EARTH_RADIUS_KM),
    vApogee: visVivaSpeed(el.semiMajorAxis, ra + EARTH_RADIUS_KM),
    raanRate: rates.raanRate,
    argpRate: rates.argOfPerigeeRate,
    ltan: ltanAt(el),
    ageDays: tleAgeDays(el.epoch, at),
  }
}

export const CLASS_LABEL: Record<OrbitClass, string> = {
  LEO: 'Low Earth orbit',
  POLAR: 'Polar orbit',
  SSO: 'Sun-synchronous orbit',
  MEO: 'Medium Earth orbit',
  GEO: 'Geosynchronous orbit',
  HEO: 'Highly elliptical orbit',
}

/** Decimal hours → "10:30" */
export function hhmm(hours: number): string {
  const h = ((hours % 24) + 24) % 24
  let hh = Math.floor(h)
  let mm = Math.round((h - hh) * 60)
  if (mm === 60) {
    mm = 0
    hh = (hh + 1) % 24
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Human TLE age: "in 424 d" for a future epoch, "3.2 d old" for a past one */
export function ageLabel(days: number): string {
  if (days < 0) return `epoch in ${Math.round(-days)} d`
  if (days < 2) return `${(days * 24).toFixed(0)} h old`
  return `${days.toFixed(days < 10 ? 1 : 0)} d old`
}