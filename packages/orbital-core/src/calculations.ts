/**
 * Launch window engine.
 *
 * A launch window opens when Earth's rotation carries the launch site through
 * the target orbital plane. For each day the engine solves for those plane
 * crossings directly (rather than brute-force scanning), applies range-safety
 * azimuth corridors, vehicle limits, lighting and weather constraints, and
 * scores each opportunity.
 */
import { EARTH_ROTATION_RAD_S, MS_PER_DAY, SUN_RATE_DEG_DAY } from './constants'
import { meanSunRightAscension } from './astro'
import { clamp, normalizeAngle, radToDeg } from './math'
import {
  circularVelocity,
  groundTrackShift,
  isDirectlyReachable,
  nextPlaneCrossing,
  nodalPrecession,
  orbitalPeriod,
  planeGeometry,
  sunSynchronousInclination,
  type PlaneGeometry,
} from './orbit'
import { ascentTrajectory, lightingAt, visibilityRegions } from './trajectory'
import { weatherAt } from './weather'
import type {
  CalculationInput,
  FeasibilityIssue,
  LaunchSite,
  LaunchWindow,
  LightingInfo,
  MissionAnalysis,
  OrbitType,
  WeatherRisk,
} from './types'

/** Default allowable RAAN error per orbit family (deg) → sets window width */
export const DEFAULT_RAAN_TOLERANCE: Record<OrbitType, number> = {
  LEO: 2,
  POLAR: 1,
  SSO: 0.5,
}

/** Default local time of ascending node for SSO missions (22:30 ⇒ 10:30 descending) */
export const DEFAULT_LTAN = 22.5

/** Hard cap on search span to keep calculations bounded */
export const MAX_RANGE_DAYS = 366

const RISK_ORDER: Record<WeatherRisk, number> = { low: 0, medium: 1, high: 2 }
const EARTH_ROTATION_DEG_S = radToDeg(EARTH_ROTATION_RAD_S)

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

export class OrbitalEngine {
  /** Validate the mission and describe the available launch geometry */
  analyzeMission(input: CalculationInput): MissionAnalysis {
    const { orbit, vehicle, launchSite: site, dateRange } = input
    const issues: FeasibilityIssue[] = []
    const ssoInclination = sunSynchronousInclination(orbit.altitude)

    if (!(dateRange.end > dateRange.start)) {
      issues.push({ severity: 'error', code: 'DATE_RANGE', message: 'End date must be after start date.' })
    } else if ((dateRange.end.getTime() - dateRange.start.getTime()) / MS_PER_DAY > MAX_RANGE_DAYS) {
      issues.push({ severity: 'error', code: 'DATE_RANGE', message: `Date range is limited to ${MAX_RANGE_DAYS} days.` })
    }

    if (!isDirectlyReachable(site.latitude, orbit.inclination)) {
      const min = Math.abs(site.latitude)
      issues.push({
        severity: 'error',
        code: 'INCLINATION_UNREACHABLE',
        message: `${orbit.inclination.toFixed(1)}° cannot be reached by direct ascent from ${site.name} (latitude ${min.toFixed(1)}°). Reachable range is ${min.toFixed(1)}°–${(180 - min).toFixed(1)}°.`,
      })
    }

    if (vehicle) {
      if (orbit.inclination < vehicle.minInclination || orbit.inclination > vehicle.maxInclination) {
        issues.push({
          severity: 'error',
          code: 'VEHICLE_INCLINATION',
          message: `${vehicle.name} supports ${vehicle.minInclination}°–${vehicle.maxInclination}° inclination.`,
        })
      }
      if (vehicle.maxAltitude !== undefined && orbit.altitude > vehicle.maxAltitude) {
        issues.push({
          severity: 'error',
          code: 'VEHICLE_ALTITUDE',
          message: `${vehicle.name} is limited to ${vehicle.maxAltitude} km circular orbits.`,
        })
      }
    }

    if (orbit.type === 'SSO' && Math.abs(orbit.inclination - ssoInclination) > 0.2) {
      issues.push({
        severity: 'warning',
        code: 'NOT_SUN_SYNCHRONOUS',
        message: `Sun-synchronous inclination at ${orbit.altitude} km is ${ssoInclination.toFixed(2)}°; ${orbit.inclination.toFixed(2)}° will drift relative to the Sun.`,
      })
    }
    if (orbit.type === 'POLAR' && Math.abs(orbit.inclination - 90) > 10) {
      issues.push({
        severity: 'warning',
        code: 'NOT_POLAR',
        message: `Polar orbits are typically within 80°–100° inclination.`,
      })
    }

    const opportunities = planeGeometry(site.latitude, orbit.inclination, orbit.altitude).map((g) => ({
      branch: g.branch,
      azimuth: g.azimuth,
      rotationalGain: g.rotationalGain,
      withinCorridor: corridorMargin(g.azimuth, site) >= 0,
    }))

    if (opportunities.length > 0 && !opportunities.some((o) => o.withinCorridor)) {
      issues.push({
        severity: 'error',
        code: 'AZIMUTH_RESTRICTED',
        message: `Required azimuths (${opportunities.map((o) => `${o.azimuth.toFixed(1)}°`).join(' / ')}) are outside the range-safety corridors at ${site.name}.`,
      })
    }

    return {
      feasible: !issues.some((i) => i.severity === 'error'),
      issues,
      periodMinutes: orbitalPeriod(orbit.altitude) / 60,
      velocityKmS: circularVelocity(orbit.altitude),
      nodalPrecessionDegDay: nodalPrecession(orbit.altitude, orbit.inclination),
      sunSynchronousInclination: ssoInclination,
      groundTrackShiftDeg: groundTrackShift(orbit.altitude, orbit.inclination),
      opportunities,
    }
  }

  /** Calculate all launch windows in the date range, sorted chronologically */
  calculateLaunchWindows(input: CalculationInput): LaunchWindow[] {
    const analysis = this.analyzeMission(input)
    if (!analysis.feasible) return []

    const { orbit, vehicle, launchSite: site, dateRange, constraints } = input
    const raanModel = this.raanModel(input)
    const tolerance = constraints?.raanTolerance ?? DEFAULT_RAAN_TOLERANCE[orbit.type]
    const halfWidthMs = (tolerance / EARTH_ROTATION_DEG_S) * 1000
    const ascentSec = vehicle?.ascentDuration ?? 540

    const geometries = planeGeometry(site.latitude, orbit.inclination, orbit.altitude).filter(
      (g) => corridorMargin(g.azimuth, site) >= 0
    )

    const windows: LaunchWindow[] = []
    for (const geometry of geometries) {
      let cursor = dateRange.start
      // Bounded loop: at most ~1 crossing per sidereal day per branch
      for (let guard = 0; guard < MAX_RANGE_DAYS + 2; guard++) {
        const { time: optimal, periodMs } = nextPlaneCrossing(
          cursor,
          site.longitude,
          geometry.nodeOffset,
          raanModel.at,
          raanModel.rate
        )
        if (optimal > dateRange.end) break
        const window = this.buildWindow(input, geometry, optimal, halfWidthMs, ascentSec, raanModel.at)
        if (window && this.passesConstraints(window, constraints)) windows.push(window)
        cursor = new Date(optimal.getTime() + periodMs / 2)
      }
    }

    return windows.sort((a, b) => a.start.getTime() - b.start.getTime())
  }

  /** RAAN of the target plane as a function of time */
  private raanModel(input: CalculationInput): { at: (t: Date) => number; rate: number } {
    const { orbit, dateRange } = input
    if (orbit.type === 'SSO') {
      const ltan = orbit.ltan ?? DEFAULT_LTAN
      return {
        at: (t) => normalizeAngle(meanSunRightAscension(t) + (ltan - 12) * 15),
        rate: SUN_RATE_DEG_DAY,
      }
    }
    const rate = nodalPrecession(orbit.altitude, orbit.inclination)
    const raan0 = orbit.raan ?? 0
    const epoch = (orbit.raanEpoch ?? dateRange.start).getTime()
    return {
      at: (t) => normalizeAngle(raan0 + (rate * (t.getTime() - epoch)) / MS_PER_DAY),
      rate,
    }
  }

  private buildWindow(
    input: CalculationInput,
    geometry: PlaneGeometry,
    optimal: Date,
    halfWidthMs: number,
    ascentSec: number,
    raanAt: (t: Date) => number
  ): LaunchWindow | null {
    const { orbit, launchSite: site, weather: forecast } = input
    const trajectory = ascentTrajectory(site, geometry.azimuth, ascentSec, orbit.altitude)
    const last = trajectory[trajectory.length - 1]
    if (!last) return null

    const insertionTime = new Date(optimal.getTime() + ascentSec * 1000)
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
      insertion: { time: insertionTime, latitude: last.latitude, longitude: last.longitude },
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
