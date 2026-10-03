import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  ORBIT_ALTITUDE,
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

/** Sensible starting configuration per orbit family (altitudes come from ORBIT_ALTITUDE) */
export const ORBIT_PRESETS: Record<OrbitType, Pick<MissionProfile, 'altitude' | 'inclination' | 'siteId' | 'vehicleId'>> = {
  LEO: { altitude: ORBIT_ALTITUDE.LEO.defaultKm, inclination: 51.64, siteId: 'KSC', vehicleId: 'FALCON_9' },
  POLAR: { altitude: ORBIT_ALTITUDE.POLAR.defaultKm, inclination: 90, siteId: 'VANDENBERG', vehicleId: 'FALCON_9' },
  SSO: {
    altitude: ORBIT_ALTITUDE.SSO.defaultKm,
    inclination: Number(sunSynchronousInclination(ORBIT_ALTITUDE.SSO.defaultKm).toFixed(2)),
    siteId: 'VANDENBERG',
    vehicleId: 'FALCON_9',
  },
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
      // Guard against stale or tampered storage referencing unknown sites/vehicles/orbits
      merge: (persisted, current) => {
        const p = (persisted as Partial<MissionState> | undefined)?.mission
        if (
          !p ||
          !(p.siteId in COMMON_LAUNCH_SITES) ||
          !(p.vehicleId in COMMON_VEHICLES) ||
          !(p.orbitType in ORBIT_ALTITUDE)
        ) {
          return current
        }
        // Old saved altitudes may fall outside the new per-orbit range: clamp them
        const range = ORBIT_ALTITUDE[p.orbitType]
        const saved = Number.isFinite(p.altitude) ? (p.altitude as number) : range.defaultKm
        const altitude = Math.min(range.max, Math.max(range.min, saved))
        // SSO tilt depends on altitude, so recompute it if we had to change the altitude
        const inclination =
          p.orbitType === 'SSO' && altitude !== saved
            ? Number(sunSynchronousInclination(altitude).toFixed(2))
            : p.inclination
        return { ...current, mission: { ...DEFAULT_MISSION, ...p, altitude, inclination: inclination ?? DEFAULT_MISSION.inclination } }
      },
    }
  )
)