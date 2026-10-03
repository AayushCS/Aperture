/**
 * Circular-orbit mechanics: period, J2 nodal precession, launch azimuth
 * and plane-crossing geometry.
 */
import {
  EARTH_RADIUS_KM,
  EARTH_ROTATION_RAD_S,
  J2,
  MU_EARTH,
  SECONDS_PER_DAY,
  SUN_RATE_DEG_DAY,
} from './constants'
import { gmst } from './astro'
import { degToRad, normalizeAngle, radToDeg, wrap180 } from './math'

export function semiMajorAxis(altitudeKm: number): number {
  return EARTH_RADIUS_KM + altitudeKm
}

/** Orbital period (s) of a circular orbit */
export function orbitalPeriod(altitudeKm: number): number {
  return 2 * Math.PI * Math.sqrt(semiMajorAxis(altitudeKm) ** 3 / MU_EARTH)
}

/** Circular orbital velocity (km/s) */
export function circularVelocity(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / semiMajorAxis(altitudeKm))
}

/** Mean motion (rad/s) */
export function meanMotion(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / semiMajorAxis(altitudeKm) ** 3)
}

/** Secular J2 regression of the ascending node (deg/day). Negative = westward drift. */
export function nodalPrecession(altitudeKm: number, inclinationDeg: number): number {
  const a = semiMajorAxis(altitudeKm)
  const rate = -1.5 * meanMotion(altitudeKm) * J2 * (EARTH_RADIUS_KM / a) ** 2 * Math.cos(degToRad(inclinationDeg))
  return radToDeg(rate) * SECONDS_PER_DAY
}

/** Inclination (deg) that makes a circular orbit at this altitude sun-synchronous */
export function sunSynchronousInclination(altitudeKm: number): number {
  const a = semiMajorAxis(altitudeKm)
  const k = radToDeg(1.5 * meanMotion(altitudeKm) * J2 * (EARTH_RADIUS_KM / a) ** 2) * SECONDS_PER_DAY
  return radToDeg(Math.acos(-SUN_RATE_DEG_DAY / k))
}

/** Ground-track westward shift per revolution at the equator (deg) */
export function groundTrackShift(altitudeKm: number, inclinationDeg: number): number {
  const periodDays = orbitalPeriod(altitudeKm) / SECONDS_PER_DAY
  return (360.98564736629 - nodalPrecession(altitudeKm, inclinationDeg)) * periodDays
}

/** Eastward surface speed due to Earth's rotation at a latitude (km/s) */
export function surfaceRotationSpeed(latitudeDeg: number): number {
  return EARTH_ROTATION_RAD_S * EARTH_RADIUS_KM * Math.cos(degToRad(latitudeDeg))
}

export type PassBranch = 'ascending' | 'descending'

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
 */
export function planeGeometry(
  latitudeDeg: number,
  inclinationDeg: number,
  altitudeKm: number
): PlaneGeometry[] {
  if (!isDirectlyReachable(latitudeDeg, inclinationDeg)) return []

  const phi = degToRad(latitudeDeg)
  const inc = degToRad(inclinationDeg)
  const sinBeta = Math.max(-1, Math.min(1, Math.cos(inc) / Math.cos(phi)))
  const beta = radToDeg(Math.asin(sinBeta))
  const sinU = Math.max(-1, Math.min(1, Math.sin(phi) / Math.sin(inc)))
  const u = radToDeg(Math.asin(sinU))

  const vOrbit = circularVelocity(altitudeKm)
  const vRot = surfaceRotationSpeed(latitudeDeg)

  const build = (branch: PassBranch, inertialAz: number, argLat: number): PlaneGeometry => {
    const az = degToRad(inertialAz)
    const relative = Math.atan2(vOrbit * Math.sin(az) - vRot, vOrbit * Math.cos(az))
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
  const relativeRate = 360.98564736629 - raanRateDegDay // deg/day
  const residual = (t: Date) => wrap180(gmst(t) + longitude - raanAt(t) - nodeOffset)

  let t = new Date(from.getTime() + (normalizeAngle(-residual(from)) / relativeRate) * 86_400_000)
  // One Newton refinement absorbs the small non-linearities of the RAAN model
  t = new Date(t.getTime() - (residual(t) / relativeRate) * 86_400_000)
  if (t < from) t = new Date(t.getTime() + (360 / relativeRate) * 86_400_000)

  return { time: t, periodMs: (360 / relativeRate) * 86_400_000 }
}

export interface GroundTrackPoint {
  time: Date
  latitude: number
  longitude: number
}

/**
 * Ground track of a circular orbit passing through a given point at `epoch`
 * (e.g. the orbit insertion point), so ascent and orbit connect seamlessly.
 */
export function groundTrackFromPoint(params: {
  altitudeKm: number
  inclinationDeg: number
  latitude: number
  longitude: number
  branch: PassBranch
  epoch: Date
  durationSec: number
  stepSec?: number
}): GroundTrackPoint[] {
  const { altitudeKm, inclinationDeg, latitude, longitude, branch, epoch, durationSec, stepSec } = params
  const inc = degToRad(inclinationDeg)
  const sinU = Math.max(-1, Math.min(1, Math.sin(degToRad(latitude)) / Math.sin(inc)))
  const u0 = radToDeg(Math.asin(sinU))
  const argumentOfLatitude = branch === 'ascending' ? u0 : 180 - u0
  const uRad = degToRad(argumentOfLatitude)
  const alpha = radToDeg(Math.atan2(Math.cos(inc) * Math.sin(uRad), Math.cos(uRad)))
  const raan = normalizeAngle(longitude + gmst(epoch) - alpha)
  return groundTrack({ altitudeKm, inclinationDeg, raan, argumentOfLatitude, epoch, durationSec, stepSec })
}

/**
 * Ground track of a circular orbit.
 * @param raan right ascension of ascending node (deg) at `epoch`
 * @param argumentOfLatitude satellite argument of latitude (deg) at `epoch`
 */
export function groundTrack(params: {
  altitudeKm: number
  inclinationDeg: number
  raan: number
  argumentOfLatitude: number
  epoch: Date
  durationSec: number
  stepSec?: number
}): GroundTrackPoint[] {
  const { altitudeKm, inclinationDeg, raan, argumentOfLatitude, epoch, durationSec } = params
  const step = params.stepSec ?? 30
  const n = radToDeg(meanMotion(altitudeKm)) // deg/s
  const raanRate = nodalPrecession(altitudeKm, inclinationDeg) / SECONDS_PER_DAY
  const inc = degToRad(inclinationDeg)
  const points: GroundTrackPoint[] = []

  for (let s = 0; s <= durationSec; s += step) {
    const time = new Date(epoch.getTime() + s * 1000)
    const u = degToRad(argumentOfLatitude + n * s)
    const latitude = radToDeg(Math.asin(Math.sin(inc) * Math.sin(u)))
    const alpha = radToDeg(Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)))
    const longitude = wrap180(raan + raanRate * s + alpha - gmst(time))
    points.push({ time, latitude, longitude })
  }
  return points
}
