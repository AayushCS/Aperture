import { useMemo } from 'react'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  nextWindow,
  orbitalEngine,
  parseTle,
  tleToElements,
  type CalculationInput,
  type LaunchSite,
  type LaunchWindow,
  type MissionAnalysis,
  type OrbitalElements,
  type Tle,
  type VehicleParams,
} from '@aperture/orbital-core'
import { DEFAULT_MISSION, useMissionStore, type MissionProfile } from '@/store/mission'
import { useForecast } from './useForecast'

/** The only launch site */
export const SITE: LaunchSite = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA

export interface MissionPlan {
  mission: MissionProfile
  site: LaunchSite
  vehicle: VehicleParams
  tle: Tle
  orbit: OrbitalElements
  input: CalculationInput
  analysis: MissionAnalysis
  windows: LaunchWindow[]
  /** Next window that has not closed yet (relative to the search start when it is in the future) */
  next: LaunchWindow | undefined
  /** Selected window, falling back to the next one */
  focus: LaunchWindow | undefined
  forecast: { status: 'loading' | 'live' | 'unavailable'; updatedAt?: Date }
}

function startOfSearch(startDate: string): Date {
  if (startDate) {
    const d = new Date(`${startDate}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return d
  }
  // Begin one hour back so a window that is currently open is still listed
  return new Date(Date.now() - 60 * 60 * 1000)
}

export function parseMissionTle(text: string): Tle {
  const r = parseTle(text)
  if (r.ok) return r.tle
  // The store only commits valid TLEs; this is a last-resort guard
  const fallback = parseTle(DEFAULT_MISSION.tle)
  if (!fallback.ok) throw new Error('Built-in mission TLE is invalid')
  return fallback.tle
}

export function buildInput(mission: MissionProfile, orbit: OrbitalElements, weather?: CalculationInput['weather']): CalculationInput {
  const start = startOfSearch(mission.startDate)
  return {
    orbit,
    vehicle: COMMON_VEHICLES[mission.vehicleId],
    launchSite: SITE,
    dateRange: { start, end: new Date(start.getTime() + mission.spanDays * 86_400_000) },
    constraints: { daylightOnly: mission.daylightOnly, maxWeatherRisk: mission.maxWeatherRisk },
    weather,
  }
}

/** Reactive launch plan for the persisted mission profile */
export function useMissionPlan(): MissionPlan {
  const mission = useMissionStore((s) => s.mission)
  const selectedId = useMissionStore((s) => s.selectedWindowId)
  const vehicle = COMMON_VEHICLES[mission.vehicleId]
  const forecastQuery = useForecast(SITE)

  const computed = useMemo(() => {
    const tle = parseMissionTle(mission.tle)
    const orbit = tleToElements(tle)
    const input = buildInput(mission, orbit, forecastQuery.data)
    const analysis = orbitalEngine.analyzeMission(input)
    const windows = analysis.feasible ? orbitalEngine.calculateLaunchWindows(input) : []
    return { tle, orbit, input, analysis, windows }
  }, [mission, forecastQuery.data])

  const now = new Date()
  const next = nextWindow(computed.windows, now > computed.input.dateRange.start ? now : computed.input.dateRange.start)
  const focus = computed.windows.find((w) => w.id === selectedId) ?? next

  return {
    mission,
    site: SITE,
    vehicle,
    ...computed,
    next,
    focus,
    forecast: {
      status: forecastQuery.isPending ? 'loading' : forecastQuery.data?.length ? 'live' : 'unavailable',
      updatedAt: forecastQuery.dataUpdatedAt ? new Date(forecastQuery.dataUpdatedAt) : undefined,
    },
  }
}