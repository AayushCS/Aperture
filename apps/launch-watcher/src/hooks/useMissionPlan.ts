import { useEffect, useMemo } from 'react'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  DEFAULT_RAAN_TOLERANCE,
  EARTH_ROTATION_RAD_S,
  ORBIT_PLANE,
  addDays,
  elementsToTle,
  nextWindow,
  normalizeAngle,
  orbitalEngine,
  raanForLtan,
  radToDeg,
  zonedDate,
  zonedTimeToUtc,
  type CalculationInput,
  type LaunchSite,
  type LaunchWindow,
  type MissionAnalysis,
  type OrbitalElements,
  type Tle,
  type VehicleParams,
} from '@aperture/orbital-core'
import { clampSearch, useMissionStore, type MissionProfile } from '@/store/mission'
import { clampStartDate } from '@/lib/searchRange'
import { requestScreening, useScreeningStore, type ScreeningState } from '@/store/screening'
import { useForecast } from './useForecast'

/** The only launch site */
export const SITE: LaunchSite = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA

export interface MissionPlan {
  mission: MissionProfile
  site: LaunchSite
  vehicle: VehicleParams
  /** Designed target orbit (epoch = search start; for LEO / polar with no start date, the plane's local day) */
  orbit: OrbitalElements
  /** LEO / polar plane anchor (undefined for SSO) */
  plane: PlaneAnchor | undefined
  /** Generated TLE: the as-flown orbit of the focused window (or the target if there is none) */
  tle: Tle
  input: CalculationInput
  analysis: MissionAnalysis
  windows: LaunchWindow[]
  /** Next window that has not closed yet (relative to the search start when it is in the future) */
  next: LaunchWindow | undefined
  /** Selected window, falling back to the next one */
  focus: LaunchWindow | undefined
  forecast: { status: 'loading' | 'live' | 'unavailable'; updatedAt?: Date }
  /** Post-insertion conjunction screen, filled in progressively by a background worker */
  screening: ScreeningState
  /** Altitude used by traffic / conjunction screening (km). Exact for circular orbits; mean of perigee and apogee otherwise */
  screeningAltitude: number
}

function startOfSearch(startDate: string, now: Date = new Date()): Date {
  if (startDate) {
    const d = new Date(`${startDate}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return d
  }
  // Begin one hour back so a window that is currently open is still listed
  return new Date(now.getTime() - 60 * 60 * 1000)
}

/** How the LEO / polar plane is anchored: the local date and instant whose insertion defines it */
export interface PlaneAnchor {
  /** Site-local calendar date (YYYY-MM-DD) of the defining insertion */
  localDate: string
  /** Plane epoch: the search start, or local midnight of `localDate` when the start is "now" */
  epoch: Date
  /** Orbit insertion on the first allowed pass of `localDate` at ORBIT_PLANE.insertionLocalTime */
  insertionTime: Date
}

/**
 * Anchor for the LEO / polar plane. With a start date, the plane is set on that date (read
 * as the site's calendar date). With no start date it is fixed per calendar day — the next day
 * whose launch window is still ahead — so Ω and the windows don't creep as the clock ticks.
 */
export function planeAnchor(mission: MissionProfile, now: Date = new Date()): PlaneAnchor {
  const tz = SITE.timeZone!
  const time = ORBIT_PLANE.insertionLocalTime[mission.orbitType === 'POLAR' ? 'POLAR' : 'LEO']
  // Clamped again here: a stored date can fall out of range when the site's day rolls over
  const date = clampStartDate(mission.startDate, now, tz) || undefined
  if (date) return { localDate: date, epoch: new Date(`${date}T00:00:00Z`), insertionTime: zonedTimeToUtc(date, time, tz) }
  // Move on to tomorrow's plane once today's launch window (liftoff one ascent before insertion) has closed
  const ascentMs = COMMON_VEHICLES[mission.vehicleId].ascentDuration * 1000
  const halfWidthMs = (DEFAULT_RAAN_TOLERANCE[mission.orbitType] / radToDeg(EARTH_ROTATION_RAD_S)) * 1000
  let localDate = zonedDate(now, tz)
  if (zonedTimeToUtc(localDate, time, tz).getTime() - ascentMs + halfWidthMs <= now.getTime()) localDate = addDays(localDate, 1)
  return { localDate, epoch: zonedTimeToUtc(localDate, '00:00', tz), insertionTime: zonedTimeToUtc(localDate, time, tz) }
}

/**
 * The user's orbit, designed to inject at perigee from the spaceport. LEO / polar: the plane
 * puts insertion at the anchor's local time (re-solved whenever inclination, perigee or apogee
 * change), drifting with J2 from there. SSO: the descending node at 10:00 mean local solar time.
 * `raanOffset` (deg) rotates the plane — used only for decorative reference orbits.
 */
export function designMissionOrbit(mission: MissionProfile, start: Date, raanOffset = 0, now: Date = new Date()): OrbitalElements {
  const design = {
    site: SITE,
    vehicle: COMMON_VEHICLES[mission.vehicleId],
    perigeeAltitude: mission.perigee,
    apogeeAltitude: mission.apogee,
    inclination: mission.inclination,
  }
  if (mission.orbitType === 'SSO') {
    const raan = raanForLtan(ORBIT_PLANE.ssoDescendingNodeHours + 12, start)
    return orbitalEngine.designOrbit({ ...design, epoch: start, raan: normalizeAngle(raan + raanOffset) })
  }
  const { epoch, insertionTime } = planeAnchor(mission, now)
  const el = orbitalEngine.designOrbitForInsertion({ ...design, epoch, insertionTime })
  return raanOffset ? { ...el, raan: normalizeAngle(el.raan + raanOffset) } : el
}

export function buildInput(profile: MissionProfile, weather?: CalculationInput['weather'], now: Date = new Date()): CalculationInput {
  const mission = { ...profile, ...clampSearch(profile, now) }
  const start = startOfSearch(mission.startDate, now)
  return {
    orbit: designMissionOrbit(mission, start, 0, now),
    vehicle: COMMON_VEHICLES[mission.vehicleId],
    launchSite: SITE,
    dateRange: { start, end: new Date(start.getTime() + mission.spanDays * 86_400_000) },
    constraints: { daylightOnly: mission.daylightOnly, maxWeatherRisk: mission.maxWeatherRisk },
    weather,
  }
}

/** TLE for an orbit: hypothetical catalog number in the unassigned 99xxx range */
export function missionTle(mission: MissionProfile, el: OrbitalElements): Tle {
  const name = (mission.name.trim() || 'MISSION').toUpperCase().slice(0, 24)
  return elementsToTle(el, {
    name,
    catalogNumber: '99901',
    intlDesignator: `${String(el.epoch.getUTCFullYear() % 100).padStart(2, '0')}999A`,
    elementSetNumber: 1,
  })
}

/** Reactive launch plan for the persisted mission profile */
export function useMissionPlan(): MissionPlan {
  const mission = useMissionStore((s) => s.mission)
  const selectedId = useMissionStore((s) => s.selectedWindowId)
  const vehicle = COMMON_VEHICLES[mission.vehicleId]
  const forecastQuery = useForecast(SITE)

  const computed = useMemo(() => {
    const now = new Date()
    const input = buildInput(mission, forecastQuery.data, now)
    const raw = orbitalEngine.analyzeMission(input)
    // Shown once as an app-wide "Simulation" banner instead of on every analysis
    const analysis = { ...raw, issues: raw.issues.filter((i) => i.code !== 'SITE_NOT_OPERATIONAL') }
    const windows = analysis.feasible ? orbitalEngine.calculateLaunchWindows(input) : []
    const plane = mission.orbitType === 'SSO' ? undefined : planeAnchor(mission, now)
    return { input, analysis, windows, orbit: input.orbit, plane }
  }, [mission, forecastQuery.data])

  // The screen flies a circular orbit; for elliptical targets it uses the mean altitude (approximation)
  const screeningAltitude = Math.round((mission.perigee + mission.apogee) / 2)
  const screening = useScreeningStore()
  useEffect(() => {
    requestScreening({ altitude: screeningAltitude, inclination: mission.inclination }, computed.windows)
  }, [screeningAltitude, mission.inclination, computed.windows])

  const now = new Date()
  const next = nextWindow(computed.windows, now > computed.input.dateRange.start ? now : computed.input.dateRange.start)
  const focus = computed.windows.find((w) => w.id === selectedId) ?? next
  const tle = useMemo(() => missionTle(mission, focus?.orbit ?? computed.orbit), [mission, focus, computed.orbit])

  return {
    mission,
    site: SITE,
    vehicle,
    ...computed,
    tle,
    next,
    focus,
    forecast: {
      status: forecastQuery.isPending ? 'loading' : forecastQuery.data?.length ? 'live' : 'unavailable',
      updatedAt: forecastQuery.dataUpdatedAt ? new Date(forecastQuery.dataUpdatedAt) : undefined,
    },
    screening,
    screeningAltitude,
  }
}