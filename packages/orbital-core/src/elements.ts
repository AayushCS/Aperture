/**
 * Elliptical orbit model: a single set of mean Keplerian elements propagated
 * with two-body motion plus J2 secular rates (node, perigee, mean anomaly).
 *
 * Accuracy: good for plane timing over days to weeks and for visualisation.
 * Drag, higher harmonics, lunisolar and SGP4 periodic terms are not modelled.
 */
import { EARTH_RADIUS_KM, J2, MU_EARTH, SECONDS_PER_DAY, SIDEREAL_RATE_DEG_DAY, SUN_RATE_DEG_DAY } from './constants'
import { gmst, sunPosition } from './astro'
import { degToRad, normalizeAngle, radToDeg, solveKepler, wrap180 } from './math'
import type { OrbitClass, OrbitalElements, PassBranch } from './types'

/** Perigee altitude above the equatorial radius (km) */
export function perigeeAltitude(el: Pick<OrbitalElements, 'semiMajorAxis' | 'eccentricity'>): number {
  return el.semiMajorAxis * (1 - el.eccentricity) - EARTH_RADIUS_KM
}

/** Apogee altitude above the equatorial radius (km) */
export function apogeeAltitude(el: Pick<OrbitalElements, 'semiMajorAxis' | 'eccentricity'>): number {
  return el.semiMajorAxis * (1 + el.eccentricity) - EARTH_RADIUS_KM
}

/** Semi-major axis and eccentricity from perigee / apogee altitudes (km) */
export function shapeFromApsides(perigeeAltKm: number, apogeeAltKm: number): { semiMajorAxis: number; eccentricity: number } {
  const rp = EARTH_RADIUS_KM + Math.min(perigeeAltKm, apogeeAltKm)
  const ra = EARTH_RADIUS_KM + Math.max(perigeeAltKm, apogeeAltKm)
  return { semiMajorAxis: (rp + ra) / 2, eccentricity: (ra - rp) / (ra + rp) }
}

/** Orbital radius (km) at a true anomaly (deg) */
export function radiusAt(el: Pick<OrbitalElements, 'semiMajorAxis' | 'eccentricity'>, trueAnomalyDeg: number): number {
  const e = el.eccentricity
  return (el.semiMajorAxis * (1 - e * e)) / (1 + e * Math.cos(degToRad(trueAnomalyDeg)))
}

/** Vis-viva speed (km/s) at radius r on an orbit of semi-major axis a */
export function visVivaSpeed(semiMajorAxisKm: number, radiusKm: number): number {
  return Math.sqrt(MU_EARTH * (2 / radiusKm - 1 / semiMajorAxisKm))
}

export interface SecularRates {
  /** Unperturbed (Keplerian) mean motion (rad/s) */
  keplerMeanMotion: number
  /** Mean anomaly rate including J2 (deg/s) */
  meanMotionDegS: number
  /** Node regression (deg/day); negative = westward */
  raanRate: number
  /** Apsidal rotation (deg/day) */
  argOfPerigeeRate: number
}

/** First-order J2 secular rates */
export function secularRates(el: Pick<OrbitalElements, 'semiMajorAxis' | 'eccentricity' | 'inclination'>): SecularRates {
  const a = el.semiMajorAxis
  const e = el.eccentricity
  const n = Math.sqrt(MU_EARTH / (a * a * a))
  const p = a * (1 - e * e)
  const k = J2 * (EARTH_RADIUS_KM / p) ** 2
  const cosI = Math.cos(degToRad(el.inclination))
  const sin2I = 1 - cosI * cosI
  const mDot = n * (1 + 0.75 * k * Math.sqrt(1 - e * e) * (2 - 3 * sin2I))
  return {
    keplerMeanMotion: n,
    meanMotionDegS: radToDeg(mDot),
    raanRate: radToDeg(-1.5 * n * k * cosI) * SECONDS_PER_DAY,
    argOfPerigeeRate: radToDeg(0.75 * n * k * (4 - 5 * sin2I)) * SECONDS_PER_DAY,
  }
}

/** Anomalistic period (perigee to perigee) including J2 (s) */
export function anomalisticPeriod(el: Pick<OrbitalElements, 'semiMajorAxis' | 'eccentricity' | 'inclination'>): number {
  return 360 / secularRates(el).meanMotionDegS
}

/** Inclination (deg) that makes an orbit of this size and shape sun-synchronous; NaN if impossible */
export function sunSynchronousInclinationFor(semiMajorAxisKm: number, eccentricity = 0): number {
  const ref = secularRates({ semiMajorAxis: semiMajorAxisKm, eccentricity, inclination: 0 }).raanRate // = −K
  const cosI = SUN_RATE_DEG_DAY / ref
  return Math.abs(cosI) <= 1 ? radToDeg(Math.acos(cosI)) : Number.NaN
}

/** Node rate within this tolerance of the Sun's mean motion counts as sun-synchronous (deg/day) */
export const SSO_RATE_TOLERANCE = 0.05

export function isSunSynchronous(el: Pick<OrbitalElements, 'semiMajorAxis' | 'eccentricity' | 'inclination'>): boolean {
  return Math.abs(secularRates(el).raanRate - SUN_RATE_DEG_DAY) <= SSO_RATE_TOLERANCE
}

/** Infer the orbit class from the elements */
export function classifyOrbit(el: OrbitalElements): OrbitClass {
  const revsPerDay = SECONDS_PER_DAY / anomalisticPeriod(el)
  if (el.eccentricity >= 0.25) return 'HEO'
  if (el.eccentricity < 0.1 && revsPerDay > 0.98 && revsPerDay < 1.02) return 'GEO'
  if (apogeeAltitude(el) > 2000) return 'MEO'
  if (isSunSynchronous(el)) return 'SSO'
  if (Math.abs(el.inclination - 90) <= 10) return 'POLAR'
  return 'LEO'
}

/** Mean anomaly (deg) for a true anomaly (deg) */
export function trueToMeanAnomaly(trueAnomalyDeg: number, e: number): number {
  const nu = degToRad(trueAnomalyDeg)
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2))
  return normalizeAngle(radToDeg(E - e * Math.sin(E)))
}

/** True anomaly (deg) for a mean anomaly (deg) */
export function meanToTrueAnomaly(meanAnomalyDeg: number, e: number): number {
  const E = degToRad(solveKepler(normalizeAngle(meanAnomalyDeg), e))
  return normalizeAngle(radToDeg(2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))))
}

export interface OrbitState {
  time: Date
  raan: number
  argOfPerigee: number
  meanAnomaly: number
  trueAnomaly: number
  /** ω + ν (deg) */
  argumentOfLatitude: number
  /** km */
  radius: number
  /** km above the equatorial radius */
  altitude: number
  /** km/s */
  speed: number
  /** Inertial (ECI, true-of-date approximation) position (km) */
  eci: { x: number; y: number; z: number }
  /** Geocentric sub-satellite point */
  latitude: number
  longitude: number
}

/** Secularly propagated elements at a time */
export function elementsAt(el: OrbitalElements, time: Date): OrbitalElements {
  const rates = secularRates(el)
  const dtSec = (time.getTime() - el.epoch.getTime()) / 1000
  const dtDay = dtSec / SECONDS_PER_DAY
  return {
    ...el,
    epoch: time,
    raan: normalizeAngle(el.raan + rates.raanRate * dtDay),
    argOfPerigee: normalizeAngle(el.argOfPerigee + rates.argOfPerigeeRate * dtDay),
    meanAnomaly: normalizeAngle(el.meanAnomaly + rates.meanMotionDegS * dtSec),
  }
}

/** ECI position (km) from node, inclination, argument of latitude and radius */
function positionInPlane(raanDeg: number, incDeg: number, uDeg: number, r: number) {
  const O = degToRad(raanDeg)
  const i = degToRad(incDeg)
  const u = degToRad(uDeg)
  const cu = Math.cos(u)
  const su = Math.sin(u)
  return {
    x: r * (Math.cos(O) * cu - Math.sin(O) * su * Math.cos(i)),
    y: r * (Math.sin(O) * cu + Math.cos(O) * su * Math.cos(i)),
    z: r * su * Math.sin(i),
  }
}

/** Satellite state at a time */
export function propagate(el: OrbitalElements, time: Date): OrbitState {
  const cur = elementsAt(el, time)
  const trueAnomaly = meanToTrueAnomaly(cur.meanAnomaly, el.eccentricity)
  const radius = radiusAt(el, trueAnomaly)
  const argumentOfLatitude = normalizeAngle(cur.argOfPerigee + trueAnomaly)
  const eci = positionInPlane(cur.raan, el.inclination, argumentOfLatitude, radius)
  return {
    time,
    raan: cur.raan,
    argOfPerigee: cur.argOfPerigee,
    meanAnomaly: cur.meanAnomaly,
    trueAnomaly,
    argumentOfLatitude,
    radius,
    altitude: radius - EARTH_RADIUS_KM,
    speed: visVivaSpeed(el.semiMajorAxis, radius),
    eci,
    latitude: radToDeg(Math.asin(eci.z / radius)),
    longitude: wrap180(radToDeg(Math.atan2(eci.y, eci.x)) - gmst(time)),
  }
}

export interface GroundTrackPoint {
  time: Date
  latitude: number
  longitude: number
  /** km */
  altitude: number
}

/** Sub-satellite ground track */
export function groundTrack(el: OrbitalElements, start: Date, durationSec: number, stepSec = 30): GroundTrackPoint[] {
  const points: GroundTrackPoint[] = []
  for (let s = 0; s <= durationSec + 1e-9; s += stepSec) {
    const p = propagate(el, new Date(start.getTime() + s * 1000))
    points.push({ time: p.time, latitude: p.latitude, longitude: p.longitude, altitude: p.altitude })
  }
  return points
}

export interface RingPoint {
  /** Geocentric latitude / Earth-fixed longitude of the direction (deg) */
  latitude: number
  longitude: number
  /** km */
  radius: number
  trueAnomaly: number
}

/**
 * The orbit ellipse frozen at an instant, expressed in Earth-fixed coordinates.
 * Used to draw the 3D orbit around a globe.
 */
export function orbitRing(el: OrbitalElements, at: Date, samples = 180): RingPoint[] {
  const cur = elementsAt(el, at)
  const theta = gmst(at)
  const out: RingPoint[] = []
  for (let k = 0; k <= samples; k++) {
    const nu = (360 * k) / samples
    const r = radiusAt(el, nu)
    const p = positionInPlane(cur.raan, el.inclination, cur.argOfPerigee + nu, r)
    out.push({
      latitude: radToDeg(Math.asin(p.z / r)),
      longitude: wrap180(radToDeg(Math.atan2(p.y, p.x)) - theta),
      radius: r,
      trueAnomaly: nu,
    })
  }
  return out
}

/** Argument of latitude (deg) of a point at `latitude` on an orbit of the given inclination and pass */
export function argumentOfLatitudeAt(latitudeDeg: number, inclinationDeg: number, branch: PassBranch): number {
  const sinU = Math.max(-1, Math.min(1, Math.sin(degToRad(latitudeDeg)) / Math.sin(degToRad(inclinationDeg))))
  const u0 = radToDeg(Math.asin(sinU))
  return normalizeAngle(branch === 'ascending' ? u0 : 180 - u0)
}

/** RAAN (deg) of the plane of given inclination that passes through a ground point at `time` on the given pass */
export function raanThroughPoint(
  latitudeDeg: number,
  longitudeDeg: number,
  inclinationDeg: number,
  branch: PassBranch,
  time: Date
): number {
  const u = degToRad(argumentOfLatitudeAt(latitudeDeg, inclinationDeg, branch))
  const alpha = radToDeg(Math.atan2(Math.cos(degToRad(inclinationDeg)) * Math.sin(u), Math.cos(u)))
  return normalizeAngle(longitudeDeg + gmst(time) - alpha)
}

/** Local mean solar time of the ascending node (h) */
export function ltanAt(el: OrbitalElements, time: Date = el.epoch): number {
  const raan = elementsAt(el, time).raan
  return (((12 + (raan - sunPosition(time).rightAscension) / 15) % 24) + 24) % 24
}

/** RAAN (deg) that gives a local time of ascending node at `time` */
export function raanForLtan(ltanHours: number, time: Date): number {
  return normalizeAngle(sunPosition(time).rightAscension + (ltanHours - 12) * 15)
}

/** Westward ground-track shift per revolution at the equator (deg) */
export function groundTrackShiftFor(el: OrbitalElements): number {
  const periodDays = anomalisticPeriod(el) / SECONDS_PER_DAY
  return (SIDEREAL_RATE_DEG_DAY - secularRates(el).raanRate) * periodDays
}