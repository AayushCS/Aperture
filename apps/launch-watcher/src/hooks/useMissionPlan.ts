import { useEffect, useMemo } from 'react'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  elementsToTle,
  nextWindow,
  orbitalEngine,
  raanForLtan,
  type CalculationInput,
  type LaunchSite,
  type LaunchWindow,
  type MissionAnalysis,
  type OrbitalElements,
  type Tle,
  type VehicleParams,
} from '@aperture/orbital-core'
import { useMissionStore, type MissionProfile } from '@/store/mission'
import { requestScreening, useScreeningStore, type ScreeningState } from '@/store/screening'
import { useForecast } from './useForecast'

/** The only launch site */
export const SITE: LaunchSite = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA

export interface MissionPlan {
  mission: MissionProfile
  site: LaunchSite
  vehicle: VehicleParams
  /** Designed target orbit (epoch = search start) */
  orbit: OrbitalElements
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

function startOfSearch(startDate: string): Date {
  if (startDate) {
    const d = new Date(`${startDate}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return d
  }
  // Begin one hour back so a window that is currently open is still listed
  return new Date(Date.now() - 60 * 60 * 1000)
}

/** The user's orbit, designed to inject at perigee from the spaceport */
export function designMissionOrbit(mission: MissionProfile, epoch: Date): OrbitalElements {
  return orbitalEngine.designOrbit({
    site: SITE,
    vehicle: COMMON_VEHICLES[mission.vehicleId],
    epoch,
    perigeeAltitude: mission.perigee,
    apogeeAltitude: mission.apogee,
    inclination: mission.inclination,
    raan: mission.orbitType === 'SSO' ? raanForLtan(mission.ltan, epoch) : mission.raan,
  })
}

export function buildInput(mission: MissionProfile, weather?: CalculationInput['weather']): CalculationInput {
  const start = startOfSearch(mission.startDate)
  return {
    orbit: designMissionOrbit(mission, start),
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
    const input = buildInput(mission, forecastQuery.data)
    const analysis = orbitalEngine.analyzeMission(input)
    const windows = analysis.feasible ? orbitalEngine.calculateLaunchWindows(input) : []
    return { input, analysis, windows, orbit: input.orbit }
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