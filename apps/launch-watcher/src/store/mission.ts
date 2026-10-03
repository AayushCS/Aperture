import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  sunSynchronousInclination,
  type LaunchSiteId,
  type OrbitType,
  type VehicleId,
  type WeatherRisk,
} from '@aperture/orbital-core'

export interface MissionProfile {
  name: string
  siteId: LaunchSiteId
  vehicleId: VehicleId
  orbitType: OrbitType
  altitude: number
  inclination: number
  /** Target RAAN (deg) — LEO / polar */
  raan: number
  /** Local time of ascending node (h) — SSO */
  ltan: number
  /** Search start, YYYY-MM-DD (UTC). Empty = today */
  startDate: string
  spanDays: number
  daylightOnly: boolean
  maxWeatherRisk: WeatherRisk
}

/** Sensible starting configuration per orbit family */
export const ORBIT_PRESETS: Record<OrbitType, Pick<MissionProfile, 'altitude' | 'inclination' | 'siteId' | 'vehicleId'>> = {
  LEO: { altitude: 420, inclination: 51.64, siteId: 'KSC', vehicleId: 'FALCON_9' },
  POLAR: { altitude: 700, inclination: 90, siteId: 'VANDENBERG', vehicleId: 'FALCON_9' },
  SSO: { altitude: 550, inclination: Number(sunSynchronousInclination(550).toFixed(2)), siteId: 'VANDENBERG', vehicleId: 'FALCON_9' },
}

export const DEFAULT_MISSION: MissionProfile = {
  name: 'Crew Rotation · ISS',
  ...ORBIT_PRESETS.LEO,
  orbitType: 'LEO',
  raan: 120,
  ltan: 22.5,
  startDate: '',
  spanDays: 14,
  daylightOnly: false,
  maxWeatherRisk: 'high',
}

interface MissionState {
  mission: MissionProfile
  selectedWindowId: string | null
  update: (patch: Partial<MissionProfile>) => void
  applyOrbitPreset: (type: OrbitType) => void
  selectWindow: (id: string | null) => void
  reset: () => void
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set) => ({
      mission: DEFAULT_MISSION,
      selectedWindowId: null,
      update: (patch) => set((s) => ({ mission: { ...s.mission, ...patch }, selectedWindowId: null })),
      applyOrbitPreset: (type) =>
        set((s) => ({ mission: { ...s.mission, orbitType: type, ...ORBIT_PRESETS[type] }, selectedWindowId: null })),
      selectWindow: (id) => set({ selectedWindowId: id }),
      reset: () => set({ mission: DEFAULT_MISSION, selectedWindowId: null }),
    }),
    {
      name: 'aperture.mission.v2',
      version: 2,
      partialize: (s) => ({ mission: s.mission }),
      // Guard against stale or tampered storage referencing unknown sites/vehicles
      merge: (persisted, current) => {
        const p = (persisted as Partial<MissionState> | undefined)?.mission
        if (!p || !(p.siteId in COMMON_LAUNCH_SITES) || !(p.vehicleId in COMMON_VEHICLES)) return current
        return { ...current, mission: { ...DEFAULT_MISSION, ...p } }
      },
    }
  )
)
