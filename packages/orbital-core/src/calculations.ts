/**
 * Launch window engine.
 *
 * The mission is a single target orbit (mean elements, usually from a TLE).
 * A launch window opens when Earth's rotation carries the launch site through
 * that orbit's plane, whose node is propagated from the TLE epoch with J2.
 * For each day the engine solves for those plane crossings directly, applies
 * range-safety azimuth corridors, vehicle limits, lighting and weather
 * constraints, places the insertion point on the target ellipse and scores
 * each opportunity.
 */
import { EARTH_RADIUS_KM, EARTH_ROTATION_RAD_S, MS_PER_DAY, SECONDS_PER_DAY, SUN_RATE_DEG_DAY } from './constants'
import { clamp, normalizeAngle, radToDeg, wrap180 } from './math'
import {
  anomalisticPeriod,
  apogeeAltitude,
  argumentOfLatitudeAt,
  classifyOrbit,
  groundTrackShiftFor,
  isSunSynchronous,
  ltanAt,
  perigeeAltitude,
  radiusAt,
  raanThroughPoint,
  secularRates,
  sunSynchronousInclinationFor,
  trueToMeanAnomaly,
  visVivaSpeed,
} from './elements'
import { isDirectlyReachable, nextPlaneCrossing, planeGeometry, type PlaneGeometry } from './orbit'
import { ascentTrajectory, lightingAt, visibilityRegions } from './trajectory'
import { weatherAt } from './weather'
import type {
  CalculationInput,
  FeasibilityIssue,
  LaunchOpportunity,
  LaunchSite,
  LaunchWindow,
  LightingInfo,
  MissionAnalysis,
  OrbitClass,
  OrbitalElements,
  PassBranch,
  TrajectoryPoint,
  WeatherRisk,
} from './types'

/** Default allowable RAAN error per orbit class (deg) → sets window width */
export const DEFAULT_RAAN_TOLERANCE: Record<OrbitClass, number> = {
  LEO: 2,
  POLAR: 1,
  SSO: 0.5,
  MEO: 2,
  GEO: 2,
  HEO: 1,
}

/** Hard cap on search span to keep calculations bounded */
export const MAX_RANGE_DAYS = 366

/** Lowest perigee (km) treated as a viable orbit */
export const MIN_PERIGEE_KM = 150

/** Plane propagation older than this (days) from the TLE epoch is flagged */
export const STALE_EPOCH_DAYS = 30

const RISK_ORDER: Record<WeatherRisk, number> = { low: 0, medium: 1, high: 2 }
const EARTH_ROTATION_DEG_S = radToDeg(EARTH_ROTATION_RAD_S)
const DEFAULT_ASCENT_SEC = 540

/** Is an azimuth inside any of the site's corridors? Returns the margin to the nearest edge (deg) or -1. */
export function corridorMargin(azimuth: number, site: LaunchSite): number {
  const corridors = site.azimuthCorridors
  if (!corridors || corridors.length === 0) return 90
  const az = normalizeAngle(azimuth)
  let best = -1
  for (const [from, to] of corridors) {
    const width = normalizeAngle(to - from)
    const offset = normalizeAngle(az - from)
    if (offset <= width) best = Math.max(best, Math.min(offset, width - offset))
  }
  return best
}

/** Where a pass inserts into the target ellipse. Independent of date: the ascent is Earth-relative. */
interface InsertionGeometry {
  trajectory: TrajectoryPoint[]
  altitude: number
  trueAnomaly: number
  argumentOfLatitude: number
  /** Direction of travel at insertion (may differ from the launch pass after crossing a vertex) */
  heading: PassBranch
}

export class OrbitalEngine {
  /** Validate the mission and describe the orbit and launch geometry */
  analyzeMission(input: CalculationInput): MissionAnalysis {
    const { orbit: el, vehicle, launchSite: site, dateRange } = input
    const issues: FeasibilityIssue[] = []
    const rates = secularRates(el)
    const rp = perigeeAltitude(el)
    const ra = apogeeAltitude(el)
    const orbitClass = classifyOrbit(el)
    const ssoInclination = sunSynchronousInclinationFor(el.semiMajorAxis, el.eccentricity)
    const sunSynchronous = isSunSynchronous(el)
    const km = (v: number) => `${Math.round(v).toLocaleString('en-US')} km`

    if (!(dateRange.end > dateRange.start)) {
      issues.push({ severity: 'error', code: 'DATE_RANGE', message: 'End date must be after start date.' })
    } else if ((dateRange.end.getTime() - dateRange.start.getTime()) / MS_PER_DAY > MAX_RANGE_DAYS) {
      issues.push({ severity: 'error', code: 'DATE_RANGE', message: `Date range is limited to ${MAX_RANGE_DAYS} days.` })
    }

    if (site.operationalFrom && dateRange.start < site.operationalFrom) {
      issues.push({
        severity: 'warning',
        code: 'SITE_NOT_OPERATIONAL',
        message: `${site.name} is not expected to support orbital launches before ${site.operationalFrom.toISOString().slice(0, 10)}. Windows earlier than that are hypothetical.`,
      })
    }

    if (rp < MIN_PERIGEE_KM) {
      issues.push({
        severity: 'error',
        code: 'PERIGEE_TOO_LOW',
        message: `Perigee of ${km(rp)} is inside the dense atmosphere; the orbit would decay almost immediately (minimum ${MIN_PERIGEE_KM} km).`,
      })
    }

    if (!isDirectlyReachable(site.latitude, el.inclination)) {
      const min = Math.abs(site.latitude)
      issues.push({
        severity: 'error',
        code: 'INCLINATION_UNREACHABLE',
        message: `${el.inclination.toFixed(1)}° cannot be reached by direct ascent from ${site.name} (latitude ${min.toFixed(1)}°). Reachable range is ${min.toFixed(1)}°–${(180 - min).toFixed(1)}°.`,
      })
    }

    if (vehicle) {
      if (el.inclination < vehicle.minInclination || el.inclination > vehicle.maxInclination) {
        issues.push({
          severity: 'error',
          code: 'VEHICLE_INCLINATION',
          message: `${vehicle.name} supports ${vehicle.minInclination}°–${vehicle.maxInclination}° inclination.`,
        })
      }
      if (vehicle.maxAltitude !== undefined && ra > vehicle.maxAltitude) {
        issues.push({
          severity: 'error',
          code: 'VEHICLE_ALTITUDE',
          message: `${vehicle.name} can reach apogees up to ${km(vehicle.maxAltitude)}; this orbit's apogee is ${km(ra)}.`,
        })
      }
    }

    if (orbitClass === 'MEO' || orbitClass === 'GEO' || orbitClass === 'HEO') {
      issues.push({
        severity: 'warning',
        code: 'HIGH_ORBIT',
        message: `This is a ${orbitClass} orbit. The engine models a direct ascent; real missions reach it through a parking or transfer orbit, so treat windows as plane timing only.`,
      })
    }

    if (!sunSynchronous && rp < 2000 && Number.isFinite(ssoInclination) && Math.abs(rates.raanRate - SUN_RATE_DEG_DAY) < 0.3) {
      issues.push({
        severity: 'warning',
        code: 'NEAR_SUN_SYNCHRONOUS',
        message: `Nearly sun-synchronous: the node drifts ${rates.raanRate.toFixed(3)}°/day against the Sun's ${SUN_RATE_DEG_DAY.toFixed(4)}°/day. Use ${ssoInclination.toFixed(2)}° inclination for an exact SSO.`,
      })
    }

    const epochGapDays = Math.abs(dateRange.start.getTime() - el.epoch.getTime()) / MS_PER_DAY
    if (epochGapDays > STALE_EPOCH_DAYS) {
      issues.push({
        severity: 'warning',
        code: 'EPOCH_DISTANT',
        message: `The search starts ${Math.round(epochGapDays)} days from the TLE epoch. The plane is propagated with J2 only, so for real satellites use a fresh TLE.`,
      })
    }

    const opportunities: LaunchOpportunity[] = this.geometries(input).map(({ geometry, insertion }) => ({
      branch: geometry.branch,
      azimuth: geometry.azimuth,
      rotationalGain: geometry.rotationalGain,
      withinCorridor: corridorMargin(geometry.azimuth, site) >= 0,
      insertionAltitude: insertion.altitude,
      insertionArgumentOfLatitude: insertion.argumentOfLatitude,
    }))

    const allowed = opportunities.filter((o) => o.withinCorridor)
    if (opportunities.length > 0 && allowed.length === 0) {
      issues.push({
        severity: 'error',
        code: 'AZIMUTH_RESTRICTED',
        message: `Required azimuths (${opportunities.map((o) => `${o.azimuth.toFixed(1)}°`).join(' / ')}) are outside the range-safety corridors at ${site.name}.`,
      })
    }

    const offPerigee = allowed.find((o) => el.eccentricity > 0.001 && o.insertionAltitude > rp + 25)
    if (offPerigee) {
      issues.push({
        severity: 'warning',
        code: 'INSERTION_OFF_PERIGEE',
        message: `On the ${offPerigee.branch} pass the vehicle inserts at ${km(offPerigee.insertionAltitude)}, ${km(offPerigee.insertionAltitude - rp)} above perigee. Set the argument of perigee to ${offPerigee.insertionArgumentOfLatitude.toFixed(1)}° to inject at perigee.`,
      })
    }

    const period = anomalisticPeriod(el)
    return {
      feasible: !issues.some((i) => i.severity === 'error'),
      issues,
      orbitClass,
      semiMajorAxisKm: el.semiMajorAxis,
      perigeeAltitudeKm: rp,
      apogeeAltitudeKm: ra,
      periodMinutes: period / 60,
      revsPerDay: SECONDS_PER_DAY / period,
      perigeeVelocityKmS: visVivaSpeed(el.semiMajorAxis, rp + EARTH_RADIUS_KM),
      apogeeVelocityKmS: visVivaSpeed(el.semiMajorAxis, ra + EARTH_RADIUS_KM),
      nodalPrecessionDegDay: rates.raanRate,
      apsidalPrecessionDegDay: rates.argOfPerigeeRate,
      sunSynchronousInclination: ssoInclination,
      sunSynchronous,
      ltan: ltanAt(el),
      groundTrackShiftDeg: groundTrackShiftFor(el),
      opportunities,
    }
  }

  /**
   * Design a target orbit for a launch from `site`: size and shape from perigee / apogee,
   * and the argument of perigee chosen so the first allowed pass injects at perigee.
   * The result always "crosses paths" with the site — every window launches into it.
   */
  designOrbit(params: {
    site: LaunchSite
    vehicle?: CalculationInput['vehicle']
    epoch: Date
    perigeeAltitude: number
    apogeeAltitude: number
    inclination: number
    raan: number
  }): OrbitalElements {
    const { site, vehicle, epoch, inclination, raan } = params
    const rp = EARTH_RADIUS_KM + Math.min(params.perigeeAltitude, params.apogeeAltitude)
    const ra = EARTH_RADIUS_KM + Math.max(params.perigeeAltitude, params.apogeeAltitude)
    let el: OrbitalElements = {
      epoch,
      semiMajorAxis: (rp + ra) / 2,
      eccentricity: (ra - rp) / (ra + rp),
      inclination,
      raan: normalizeAngle(raan),
      argOfPerigee: 0,
      meanAnomaly: 0,
    }
    if (el.eccentricity < 1e-6) return el
    const dateRange = { start: epoch, end: new Date(epoch.getTime() + MS_PER_DAY) }
    // Insertion latitude depends weakly on the insertion altitude; two or three passes converge
    for (let k = 0; k < 3; k++) {
      const pass = this.geometries({ orbit: el, launchSite: site, vehicle, dateRange }).find(
        ({ geometry }) => corridorMargin(geometry.azimuth, site) >= 0
      )
      if (!pass) break
      el = { ...el, argOfPerigee: pass.insertion.argumentOfLatitude }
    }
    return el
  }

  /** Calculate all launch windows in the date range, sorted chronologically */
  calculateLaunchWindows(input: CalculationInput): LaunchWindow[] {
    const analysis = this.analyzeMission(input)
    if (!analysis.feasible) return []

    const { orbit: el, launchSite: site, dateRange, constraints } = input
    const rate = secularRates(el).raanRate
    const raanAt = (t: Date) => normalizeAngle(el.raan + (rate * (t.getTime() - el.epoch.getTime())) / MS_PER_DAY)
    const tolerance = constraints?.raanTolerance ?? DEFAULT_RAAN_TOLERANCE[analysis.orbitClass]
    const halfWidthMs = (tolerance / EARTH_ROTATION_DEG_S) * 1000

    const windows: LaunchWindow[] = []
    for (const { geometry, insertion } of this.geometries(input)) {
      if (corridorMargin(geometry.azimuth, site) < 0) continue
      const ascentMs = (insertion.trajectory[insertion.trajectory.length - 1]?.t ?? 0) * 1000
      let leadMs: number | undefined
      // Start a little early: a lagging liftoff can fall after the range start even if its crossing does not
      let cursor = new Date(dateRange.start.getTime() - 30 * 60_000)
      // Bounded loop: at most ~1 crossing per sidereal day per branch
      for (let guard = 0; guard < MAX_RANGE_DAYS + 2; guard++) {
        const { time: crossing, periodMs } = nextPlaneCrossing(cursor, site.longitude, geometry.nodeOffset, raanAt, rate)
        // Earth turns ~0.25°/min during the ascent, so the plane reached at insertion is offset from the
        // plane the pad sat in at liftoff. Lead the liftoff by that offset so insertion lands in the target plane.
        if (leadMs === undefined) {
          const last = insertion.trajectory[insertion.trajectory.length - 1]!
          const tIns = new Date(crossing.getTime() + ascentMs)
          const fitted = raanThroughPoint(last.latitude, last.longitude, el.inclination, insertion.heading, tIns)
          leadMs = (wrap180(fitted - raanAt(tIns)) / (EARTH_ROTATION_DEG_S - rate / SECONDS_PER_DAY)) * 1000
        }
        const optimal = new Date(crossing.getTime() - leadMs)
        if (optimal > dateRange.end) break
        cursor = new Date(crossing.getTime() + periodMs / 2)
        if (optimal < dateRange.start) continue
        const window = this.buildWindow(input, geometry, insertion, optimal, halfWidthMs, raanAt)
        if (window && this.passesConstraints(window, constraints)) windows.push(window)
      }
    }

    return windows.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  /** Plane geometry and insertion point for each pass */
  private geometries(input: CalculationInput): Array<{ geometry: PlaneGeometry; insertion: InsertionGeometry }> {
    const { orbit: el, launchSite: site } = input
    const speed = visVivaSpeed(el.semiMajorAxis, el.semiMajorAxis)
    return planeGeometry(site.latitude, el.inclination, speed).map((geometry) => ({
      geometry,
      insertion: this.insertionGeometry(input, geometry),
    }))
  }

  /**
   * The ascent reaches the target plane at the end of the trajectory. Its argument of
   * latitude u fixes the true anomaly ν = u − ω on the target ellipse, which sets the
   * insertion altitude; the trajectory is re-solved for that altitude.
   */
  private insertionGeometry(input: CalculationInput, geometry: PlaneGeometry): InsertionGeometry {
    const { orbit: el, launchSite: site, vehicle } = input
    const ascentSec = vehicle?.ascentDuration ?? DEFAULT_ASCENT_SEC
    let altitude = Math.max(MIN_PERIGEE_KM, perigeeAltitude(el))
    let result: InsertionGeometry | undefined
    for (let k = 0; k < 3; k++) {
      const trajectory = ascentTrajectory(site, geometry.azimuth, ascentSec, altitude)
      const last = trajectory[trajectory.length - 1]!
      const prev = trajectory[trajectory.length - 2] ?? last
      const heading: PassBranch = last.latitude >= prev.latitude ? 'ascending' : 'descending'
      const u = argumentOfLatitudeAt(last.latitude, el.inclination, heading)
      const trueAnomaly = normalizeAngle(u - el.argOfPerigee)
      result = { trajectory, altitude, trueAnomaly, argumentOfLatitude: u, heading }
      altitude = radiusAt(el, trueAnomaly) - EARTH_RADIUS_KM
    }
    // Final trajectory consistent with the converged altitude
    const trajectory = ascentTrajectory(site, geometry.azimuth, ascentSec, altitude)
    return { ...result!, trajectory, altitude }
  }

  private buildWindow(
    input: CalculationInput,
    geometry: PlaneGeometry,
    insertion: InsertionGeometry,
    optimal: Date,
    halfWidthMs: number,
    raanAt: (t: Date) => number
  ): LaunchWindow | null {
    const { orbit: el, launchSite: site, weather: forecast } = input
    const { trajectory } = insertion
    const last = trajectory[trajectory.length - 1]
    if (!last) return null

    const insertionTime = new Date(optimal.getTime() + last.t * 1000)
    const lighting = lightingAt(site, optimal, trajectory)
    const weather = weatherAt(site, optimal, forecast)

    const scoreBreakdown = {
      weather: 1 - weather.violationProbability,
      performance: clamp((geometry.rotationalGain + 0.465) / 0.93, 0, 1),
      corridor: clamp(corridorMargin(geometry.azimuth, site) / 15, 0, 1),
      viewing: this.viewingScore(lighting),
    }
    const quality =
      0.5 * scoreBreakdown.weather +
      0.2 * scoreBreakdown.performance +
      0.15 * scoreBreakdown.corridor +
      0.15 * scoreBreakdown.viewing

    return {
      id: `${geometry.branch}-${optimal.toISOString()}`,
      start: new Date(optimal.getTime() - halfWidthMs),
      end: new Date(optimal.getTime() + halfWidthMs),
      optimal,
      duration: Math.round((2 * halfWidthMs) / 1000),
      quality: Math.round(quality * 1000) / 1000,
      scoreBreakdown,
      weatherRisk: weather.risk,
      weather,
      branch: geometry.branch,
      azimuth: Math.round(geometry.azimuth * 100) / 100,
      insertion: {
        time: insertionTime,
        latitude: last.latitude,
        longitude: last.longitude,
        altitude: insertion.altitude,
        trueAnomaly: insertion.trueAnomaly,
      },
      // As flown: the plane through the insertion point, with the target size, shape and perigee
      orbit: {
        epoch: insertionTime,
        semiMajorAxis: el.semiMajorAxis,
        eccentricity: el.eccentricity,
        inclination: el.inclination,
        raan: raanThroughPoint(last.latitude, last.longitude, el.inclination, insertion.heading, insertionTime),
        argOfPerigee: el.argOfPerigee,
        meanAnomaly: trueToMeanAnomaly(insertion.trueAnomaly, el.eccentricity),
      },
      lighting,
      visibilityRegions: visibilityRegions(optimal, trajectory, lighting),
      trajectory,
      raan: Math.round(raanAt(insertionTime) * 100) / 100,
    }
  }

  private viewingScore(lighting: LightingInfo): number {
    if (lighting.plumeSunlit) return 1
    if (lighting.condition === 'twilight') return 0.8
    if (lighting.condition === 'night') return 0.7
    return 0.6
  }

  private passesConstraints(window: LaunchWindow, constraints: CalculationInput['constraints']): boolean {
    if (!constraints) return true
    if (constraints.daylightOnly && window.lighting.condition !== 'day') return false
    if (constraints.minSunElevation !== undefined && window.lighting.sunElevation < constraints.minSunElevation) {
      return false
    }
    if (constraints.maxWeatherRisk && RISK_ORDER[window.weatherRisk] > RISK_ORDER[constraints.maxWeatherRisk]) {
      return false
    }
    return true
  }
}

/** First window that has not yet closed at `now` */
export function nextWindow(windows: readonly LaunchWindow[], now: Date = new Date()): LaunchWindow | undefined {
  return windows.find((w) => w.end.getTime() > now.getTime())
}