/**
 * Ascent trajectory model and ground visibility footprints.
 *
 * The ascent follows a great circle from the pad along the Earth-relative
 * flight azimuth. Altitude and downrange follow smooth profiles fitted to
 * typical two-stage LEO ascents (≈ 1,900 km downrange at a 9-minute insertion).
 */
import { EARTH_RADIUS_KM } from './constants'
import { horizonDip, sunElevation } from './astro'
import { circularVelocity } from './orbit'
import { degToRad, radToDeg, wrap180 } from './math'
import type { GeoRegion, LaunchSite, LightingInfo, TrajectoryPoint, VisibilityQuality } from './types'

/** Destination point along a great circle (deg, km) */
export function destinationPoint(
  latitude: number,
  longitude: number,
  azimuthDeg: number,
  distanceKm: number
): { latitude: number; longitude: number } {
  const delta = distanceKm / EARTH_RADIUS_KM
  const theta = degToRad(azimuthDeg)
  const phi1 = degToRad(latitude)
  const lambda1 = degToRad(longitude)
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    )
  return { latitude: radToDeg(phi2), longitude: wrap180(radToDeg(lambda2)) }
}

/**
 * Ground distance (km) at which an object at `altitudeKm` appears at `minElevationDeg`
 * above an observer's horizon (spherical Earth).
 */
export function visibilityRadius(altitudeKm: number, minElevationDeg: number): number {
  const e = degToRad(minElevationDeg)
  const ratio = (EARTH_RADIUS_KM * Math.cos(e)) / (EARTH_RADIUS_KM + altitudeKm)
  const centralAngle = Math.acos(Math.min(1, ratio)) - e
  return Math.max(0, centralAngle) * EARTH_RADIUS_KM
}

/** Sample the ascent from liftoff to insertion */
export function ascentTrajectory(
  site: LaunchSite,
  azimuth: number,
  ascentDurationSec: number,
  insertionAltitudeKm: number,
  stepSec = 15
): TrajectoryPoint[] {
  // Mean horizontal speed during ascent ≈ 45% of orbital velocity
  const downrangeTotal = 0.45 * circularVelocity(insertionAltitudeKm) * ascentDurationSec
  const points: TrajectoryPoint[] = []
  const steps = Math.max(2, Math.ceil(ascentDurationSec / stepSec))

  for (let i = 0; i <= steps; i++) {
    const t = Math.min(ascentDurationSec, i * stepSec)
    const f = t / ascentDurationSec
    const altitude = site.altitude / 1000 + insertionAltitudeKm * Math.sin((Math.PI / 2) * Math.pow(f, 0.7))
    const downrange = downrangeTotal * Math.pow(f, 2.2)
    const { latitude, longitude } = destinationPoint(site.latitude, site.longitude, azimuth, downrange)
    points.push({ t, latitude, longitude, altitude, downrange })
  }
  return points
}

/** Lighting conditions for spectators at liftoff */
export function lightingAt(site: LaunchSite, liftoff: Date, trajectory: TrajectoryPoint[]): LightingInfo {
  const elevation = sunElevation(liftoff, site.latitude, site.longitude)
  const condition = elevation > -0.833 ? 'day' : elevation > -12 ? 'twilight' : 'night'

  // Is the plume in sunlight at ~2–4 minutes after liftoff (100–200 km altitude)?
  const sample = trajectory.find((p) => p.t >= 180) ?? trajectory[trajectory.length - 1]!
  const time = new Date(liftoff.getTime() + sample.t * 1000)
  const plumeSunlit =
    condition !== 'day' && sunElevation(time, sample.latitude, sample.longitude) > -horizonDip(sample.altitude)

  return { condition, sunElevation: Math.round(elevation * 10) / 10, plumeSunlit }
}

/**
 * Viewing footprints along the ascent. Each zone is the ground area from which
 * the vehicle rises above a minimum elevation angle at the sampled ascent time.
 */
export function visibilityRegions(
  liftoff: Date,
  trajectory: TrajectoryPoint[],
  lighting: LightingInfo
): GeoRegion[] {
  const at = (sec: number) => trajectory.find((p) => p.t >= sec) ?? trajectory[trajectory.length - 1]!
  const darkSky = lighting.condition !== 'day'

  const zones: Array<{ sec: number; minElevation: number; quality: VisibilityQuality; label: string; span: number }> = [
    { sec: 45, minElevation: 20, quality: 'high', label: 'Prime viewing', span: 120 },
    { sec: 150, minElevation: 10, quality: darkSky ? 'high' : 'medium', label: 'Downrange', span: 150 },
    { sec: 300, minElevation: 5, quality: lighting.plumeSunlit ? 'medium' : 'low', label: 'Distant horizon', span: 180 },
  ]

  return zones.map(({ sec, minElevation, quality, label, span }) => {
    const p = at(sec)
    const start = new Date(liftoff.getTime() + Math.max(0, p.t - span / 2) * 1000)
    return {
      latitude: p.latitude,
      longitude: p.longitude,
      radius: Math.round(visibilityRadius(p.altitude, minElevation)),
      visibilityStart: start,
      visibilityEnd: new Date(start.getTime() + span * 1000),
      quality,
      label,
    }
  })
}
