import { useMemo } from 'react'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  nextWindow,
  orbitalEngine,
  type CalculationInput,
  type LaunchSite,
  type LaunchWindow,
  type MissionAnalysis,
  type VehicleParams,
} from '@aperture/orbital-core'
import { useMissionStore, type MissionProfile } from '@/store/mission'
import { useForecast } from './useForecast'

export interface MissionPlan {
  mission: MissionProfile
  site: LaunchSite
  vehicle: VehicleParams
  input: CalculationInput
  analysis: MissionAnalysis
  windows: LaunchWindow[]
  /** Next window that has not closed yet */
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

export function buildInput(mission: MissionProfile, weather?: CalculationInput['weather']): CalculationInput {
  const start = startOfSearch(mission.startDate)
  return {
    orbit: {
      type: mission.orbitType,
      altitude: mission.altitude,
      inclination: mission.inclination,
      raan: mission.raan,
      raanEpoch: new Date('2026-01-01T00:00:00Z'),
      ltan: mission.ltan,
    },
    vehicle: COMMON_VEHICLES[mission.vehicleId],
    launchSite: COMMON_LAUNCH_SITES[mission.siteId],
    dateRange: { start, end: new Date(start.getTime() + mission.spanDays * 86_400_000) },
    constraints: { daylightOnly: mission.daylightOnly, maxWeatherRisk: mission.maxWeatherRisk },
    weather,
  }
}

/** Reactive launch plan for the persisted mission profile */
export function useMissionPlan(): MissionPlan {
  const mission = useMissionStore((s) => s.mission)
  const selectedId = useMissionStore((s) => s.selectedWindowId)
  const site = COMMON_LAUNCH_SITES[mission.siteId]
  const vehicle = COMMON_VEHICLES[mission.vehicleId]
  const forecastQuery = useForecast(site)

  const computed = useMemo(() => {
    const input = buildInput(mission, forecastQuery.data)
    const analysis = orbitalEngine.analyzeMission(input)
    const windows = analysis.feasible ? orbitalEngine.calculateLaunchWindows(input) : []
    return { input, analysis, windows }
  }, [mission, forecastQuery.data])

  const next = nextWindow(computed.windows)
  const focus = computed.windows.find((w) => w.id === selectedId) ?? next

  return {
    mission,
    site,
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
