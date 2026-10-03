/**
 * Launch geometry: reachability, launch azimuth and plane-crossing timing,
 * plus convenience helpers for circular orbits.
 */
import { EARTH_RADIUS_KM, EARTH_ROTATION_RAD_S, MU_EARTH, SIDEREAL_RATE_DEG_DAY } from './constants'
import { gmst } from './astro'
import { degToRad, normalizeAngle, radToDeg, wrap180 } from './math'
import { groundTrackShiftFor, secularRates, sunSynchronousInclinationFor } from './elements'
import type { PassBranch } from './types'

const circular = (altitudeKm: number, inclination = 0) => ({
  semiMajorAxis: EARTH_RADIUS_KM + altitudeKm,
  eccentricity: 0,
  inclination,
})

export function semiMajorAxis(altitudeKm: number): number {
  return EARTH_RADIUS_KM + altitudeKm
}

/** Keplerian period (s) of a circular orbit */
export function orbitalPeriod(altitudeKm: number): number {
  return 2 * Math.PI * Math.sqrt(semiMajorAxis(altitudeKm) ** 3 / MU_EARTH)
}

/** Circular orbital velocity (km/s) */
export function circularVelocity(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / semiMajorAxis(altitudeKm))
}

/** Keplerian mean motion of a circular orbit (rad/s) */
export function meanMotion(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / semiMajorAxis(altitudeKm) ** 3)
}

/** Secular J2 regression of the ascending node for a circular orbit (deg/day). Negative = westward. */
export function nodalPrecession(altitudeKm: number, inclinationDeg: number): number {
  return secularRates(circular(altitudeKm, inclinationDeg)).raanRate
}

/** Inclination (deg) that makes a circular orbit at this altitude sun-synchronous */
export function sunSynchronousInclination(altitudeKm: number): number {
  return sunSynchronousInclinationFor(semiMajorAxis(altitudeKm), 0)
}

/** Ground-track westward shift per revolution at the equator for a circular orbit (deg) */
export function groundTrackShift(altitudeKm: number, inclinationDeg: number): number {
  return groundTrackShiftFor({ ...circular(altitudeKm, inclinationDeg), epoch: new Date(0), raan: 0, argOfPerigee: 0, meanAnomaly: 0 })
}

/** Eastward surface speed due to Earth's rotation at a latitude (km/s) */
export function surfaceRotationSpeed(latitudeDeg: number): number {
  return EARTH_ROTATION_RAD_S * EARTH_RADIUS_KM * Math.cos(degToRad(latitudeDeg))
}

export interface PlaneGeometry {
  branch: PassBranch
  /** Inertial launch azimuth (deg from north) */
  inertialAzimuth: number
  /** Azimuth flown relative to the rotating Earth (deg from north) */
  azimuth: number
  /** Argument of latitude of the launch site within the target plane (deg) */
  argumentOfLatitude: number
  /** Right-ascension offset of the site from the ascending node (deg) */
  nodeOffset: number
  /** Velocity contributed (or lost, if negative) by Earth's rotation along the flight path (km/s) */
  rotationalGain: number
}

/** Can a direct (no dogleg) ascent from this latitude reach the inclination? */
export function isDirectlyReachable(latitudeDeg: number, inclinationDeg: number): boolean {
  return Math.abs(Math.cos(degToRad(inclinationDeg))) <= Math.cos(degToRad(latitudeDeg)) + 1e-9
}

/**
 * Plane-crossing geometry for both passes of the launch site under a target orbital plane.
 * Returns an empty array when the inclination is unreachable from the site latitude.
 * @param insertionSpeedKmS inertial speed at orbit insertion (sets the Earth-relative azimuth)
 */
export function planeGeometry(latitudeDeg: number, inclinationDeg: number, insertionSpeedKmS: number): PlaneGeometry[] {
  if (!isDirectlyReachable(latitudeDeg, inclinationDeg)) return []

  const phi = degToRad(latitudeDeg)
  const inc = degToRad(inclinationDeg)
  const sinBeta = Math.max(-1, Math.min(1, Math.cos(inc) / Math.cos(phi)))
  const beta = radToDeg(Math.asin(sinBeta))
  const sinU = Math.max(-1, Math.min(1, Math.sin(phi) / Math.sin(inc)))
  const u = radToDeg(Math.asin(sinU))
  const vRot = surfaceRotationSpeed(latitudeDeg)

  const build = (branch: PassBranch, inertialAz: number, argLat: number): PlaneGeometry => {
    const az = degToRad(inertialAz)
    const relative = Math.atan2(insertionSpeedKmS * Math.sin(az) - vRot, insertionSpeedKmS * Math.cos(az))
    const uRad = degToRad(argLat)
    return {
      branch,
      inertialAzimuth: normalizeAngle(inertialAz),
      azimuth: normalizeAngle(radToDeg(relative)),
      argumentOfLatitude: normalizeAngle(argLat),
      nodeOffset: normalizeAngle(radToDeg(Math.atan2(Math.cos(inc) * Math.sin(uRad), Math.cos(uRad)))),
      rotationalGain: vRot * Math.sin(az),
    }
  }

  const ascending = build('ascending', beta, u)
  // At i == |φ| both passes coincide (single due-east/west opportunity)
  if (Math.abs(Math.abs(inclinationDeg) - Math.abs(latitudeDeg)) < 1e-6) return [ascending]
  return [ascending, build('descending', 180 - beta, 180 - u)]
}

/**
 * Find the first instant ≥ `from` when a site at `longitude` lies in the plane,
 * for the given node offset. `raanAt` gives the plane's RAAN (deg) as a function of time.
 * Returns the crossing time and the period between successive crossings (ms).
 */
export function nextPlaneCrossing(
  from: Date,
  longitude: number,
  nodeOffset: number,
  raanAt: (t: Date) => number,
  raanRateDegDay: number
): { time: Date; periodMs: number } {
  const relativeRate = SIDEREAL_RATE_DEG_DAY - raanRateDegDay // deg/day
  const residual = (t: Date) => wrap180(gmst(t) + longitude - raanAt(t) - nodeOffset)

  let t = new Date(from.getTime() + (normalizeAngle(-residual(from)) / relativeRate) * 86_400_000)
  // One Newton refinement absorbs the small non-linearities of the RAAN model
  t = new Date(t.getTime() - (residual(t) / relativeRate) * 86_400_000)
  if (t < from) t = new Date(t.getTime() + (360 / relativeRate) * 86_400_000)

  return { time: t, periodMs: (360 / relativeRate) * 86_400_000 }
}