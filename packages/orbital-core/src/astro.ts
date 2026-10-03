/**
 * Time systems, sidereal time and low-precision solar ephemeris.
 * Accuracy: GMST < 0.1 s, solar position ≈ 0.01° (1950–2050).
 */
import { EARTH_RADIUS_KM, MS_PER_DAY, SIDEREAL_RATE_DEG_DAY } from './constants'
import { degToRad, normalizeAngle, radToDeg } from './math'

const J2000 = 2451545.0

/** Julian date (UTC ≈ UT1 for this purpose) */
export function julianDate(date: Date): number {
  return date.getTime() / MS_PER_DAY + 2440587.5
}

/** Greenwich Mean Sidereal Time in degrees [0, 360) — IAU 1982 */
export function gmst(date: Date): number {
  const d = julianDate(date) - J2000
  const T = d / 36525
  return normalizeAngle(
    280.46061837 + SIDEREAL_RATE_DEG_DAY * d + 0.000387933 * T * T - (T * T * T) / 38710000
  )
}

export interface SunPosition {
  /** Right ascension (deg) */
  rightAscension: number
  /** Declination (deg) */
  declination: number
}

/** Apparent solar right ascension and declination (Astronomical Almanac low-precision formula) */
export function sunPosition(date: Date): SunPosition {
  const n = julianDate(date) - J2000
  const L = normalizeAngle(280.46 + 0.9856474 * n)
  const g = degToRad(normalizeAngle(357.528 + 0.9856003 * n))
  const lambda = degToRad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g))
  const epsilon = degToRad(23.439 - 0.0000004 * n)

  return {
    rightAscension: normalizeAngle(
      radToDeg(Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)))
    ),
    declination: radToDeg(Math.asin(Math.sin(epsilon) * Math.sin(lambda))),
  }
}

/** Geometric elevation of the Sun's centre above the horizon (deg) for an observer */
export function sunElevation(date: Date, latitude: number, longitude: number): number {
  const { rightAscension, declination } = sunPosition(date)
  const hourAngle = degToRad(gmst(date) + longitude - rightAscension)
  const lat = degToRad(latitude)
  const dec = degToRad(declination)
  return radToDeg(
    Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle))
  )
}

/** Sub-solar point (where the Sun is at zenith) */
export function subsolarPoint(date: Date): { latitude: number; longitude: number } {
  const { rightAscension, declination } = sunPosition(date)
  return {
    latitude: declination,
    longitude: normalizeAngle(rightAscension - gmst(date) + 180) - 180,
  }
}

/** Dip of the true horizon seen from altitude h (deg) — how far below 0° the Sun can be and still illuminate */
export function horizonDip(altitudeKm: number): number {
  return radToDeg(Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + Math.max(0, altitudeKm))))
}

/** Local mean solar time in hours [0, 24) */
export function localSolarTime(date: Date, longitude: number): number {
  const utcHours = (date.getTime() % MS_PER_DAY) / 3_600_000
  return (((utcHours + longitude / 15) % 24) + 24) % 24
}
