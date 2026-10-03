import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COMMON_VEHICLES,
  ORBIT_ALTITUDE,
  shapeFromApsides,
  sunSynchronousInclinationFor,
  type OrbitFamily,
  type VehicleId,
  type WeatherRisk,
} from '@aperture/orbital-core'

export type { OrbitFamily }

/**
 * The mission is one orbit, described by the user. The app designs it so a
 * launch from Spaceport Nova Scotia injects at perigee and generates its TLE.
 */
export interface MissionProfile {
  name: string
  orbitType: OrbitFamily
  /** km */
  perigee: number
  /** km */
  apogee: number
  /** deg — derived automatically for SSO */
  inclination: number
  /** RAAN at the search start (deg) — LEO / polar */
  raan: number
  /** Local time of ascending node (h) — SSO */
  ltan: number
  vehicleId: VehicleId
  /** Search start, YYYY-MM-DD (UTC). Empty = now */
  startDate: string
  spanDays: number
  daylightOnly: boolean
  maxWeatherRisk: WeatherRisk
}

export type GlobeLayer = 'terminator' | 'graticule' | 'track' | 'ring' | 'footprint' | 'ascent' | 'labels'

export interface GlobeSettings {
  layers: Record<GlobeLayer, boolean>
  revolutions: number
  speed: number
}

/** Sun-synchronous inclination for an elliptical orbit with these apsides */
export function ssoInclination(perigee: number, apogee: number): number {
  const { semiMajorAxis, eccentricity } = shapeFromApsides(perigee, apogee)
  return Number(sunSynchronousInclinationFor(semiMajorAxis, eccentricity).toFixed(4))
}

/** Starting point per family: circular at the family's default altitude (ORBIT_ALTITUDE); all reachable from Canso */
const preset = (family: OrbitFamily, inclination: number) => {
  const alt = ORBIT_ALTITUDE[family].defaultKm
  return { perigee: alt, apogee: alt, inclination }
}
export const ORBIT_PRESETS: Record<OrbitFamily, Pick<MissionProfile, 'perigee' | 'apogee' | 'inclination'>> = {
  LEO: preset('LEO', 51.6),
  POLAR: preset('POLAR', 90),
  SSO: preset('SSO', ssoInclination(ORBIT_ALTITUDE.SSO.defaultKm, ORBIT_ALTITUDE.SSO.defaultKm)),
}

/** Keep perigee / apogee inside the family's allowed altitude range */
export function clampAltitudes(family: OrbitFamily, perigee: number, apogee: number): { perigee: number; apogee: number } {
  const { min, max } = ORBIT_ALTITUDE[family]
  const clamp = (v: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : ORBIT_ALTITUDE[family].defaultKm))
  const p = clamp(perigee)
  return { perigee: p, apogee: Math.max(p, clamp(apogee)) }
}

export const ORBIT_LIMITS: Record<OrbitFamily, { minInc: number; maxInc: number }> = {
  LEO: { minInc: 45.4, maxInc: 80 },
  POLAR: { minInc: 80, maxInc: 100 },
  SSO: { minInc: 95, maxInc: 105 },
}

export const DEFAULT_MISSION: MissionProfile = {
  name: 'APERTURE-1',
  orbitType: 'SSO',
  ...ORBIT_PRESETS.SSO,
  raan: 0,
  ltan: 22.5,
  vehicleId: 'SPECTRUM',
  // First orbital season at Spaceport Nova Scotia
  startDate: '2027-12-01',
  spanDays: 14,
  daylightOnly: false,
  maxWeatherRisk: 'high',
}

export const DEFAULT_GLOBE: GlobeSettings = {
  layers: { terminator: true, graticule: true, track: true, ring: true, footprint: true, ascent: true, labels: true },
  revolutions: 1,
  speed: 300,
}

interface MissionState {
  mission: MissionProfile
  globe: GlobeSettings
  selectedWindowId: string | null
  /** Open dialog: generated TLE ('mission') or the launch site */
  inspecting: 'mission' | 'site' | null
  update: (patch: Partial<MissionProfile>) => void
  applyOrbitPreset: (type: OrbitFamily) => void
  setGlobe: (patch: Partial<GlobeSettings>) => void
  toggleLayer: (layer: GlobeLayer) => void
  selectWindow: (id: string | null) => void
  inspect: (id: 'mission' | 'site' | null) => void
  reset: () => void
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set) => ({
      mission: DEFAULT_MISSION,
      globe: DEFAULT_GLOBE,
      selectedWindowId: null,
      inspecting: null,
      update: (patch) =>
        set((s) => {
          const mission = { ...s.mission, ...patch }
          Object.assign(mission, clampAltitudes(mission.orbitType, mission.perigee, mission.apogee))
          // Keep SSO exactly sun-synchronous as the altitudes change
          if (mission.orbitType === 'SSO') mission.inclination = ssoInclination(mission.perigee, mission.apogee)
          return { mission, selectedWindowId: null }
        }),
      applyOrbitPreset: (type) => set((s) => ({ mission: { ...s.mission, orbitType: type, ...ORBIT_PRESETS[type] }, selectedWindowId: null })),
      setGlobe: (patch) => set((s) => ({ globe: { ...s.globe, ...patch } })),
      toggleLayer: (layer) => set((s) => ({ globe: { ...s.globe, layers: { ...s.globe.layers, [layer]: !s.globe.layers[layer] } } })),
      selectWindow: (id) => set({ selectedWindowId: id }),
      inspect: (id) => set({ inspecting: id }),
      reset: () => set({ mission: DEFAULT_MISSION, globe: DEFAULT_GLOBE, selectedWindowId: null }),
    }),
    {
      // v5: per-orbit default altitudes from testing — older saved missions start fresh
      name: 'aperture.mission.v5',
      version: 5,
      partialize: (s) => ({ mission: s.mission, globe: s.globe }),
      // Guard against stale or tampered storage
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<MissionState, 'mission' | 'globe'>> | undefined
        const m = p?.mission
        const valid =
          m &&
          m.orbitType in ORBIT_PRESETS &&
          m.vehicleId in COMMON_VEHICLES &&
          [m.perigee, m.apogee, m.inclination, m.raan, m.ltan].every((v) => typeof v === 'number' && Number.isFinite(v))
        // Old saved altitudes may fall outside the per-orbit range: clamp them (and keep SSO sun-synchronous)
        let mission = current.mission
        if (valid) {
          mission = { ...DEFAULT_MISSION, ...m, ...clampAltitudes(m.orbitType, m.perigee, m.apogee) }
          if (mission.orbitType === 'SSO') mission.inclination = ssoInclination(mission.perigee, mission.apogee)
        }
        return {
          ...current,
          mission,
          globe: p?.globe ? { ...DEFAULT_GLOBE, ...p.globe, layers: { ...DEFAULT_GLOBE.layers, ...p.globe.layers } } : current.globe,
        }
      },
    }
  )
)