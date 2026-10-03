import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { COMMON_VEHICLES, shapeFromApsides, sunSynchronousInclinationFor, type VehicleId, type WeatherRisk } from '@aperture/orbital-core'

/** Orbit family chosen by the user */
export type OrbitFamily = 'LEO' | 'POLAR' | 'SSO'

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

/** Starting point per family — all reachable over open ocean from Canso */
export const ORBIT_PRESETS: Record<OrbitFamily, Pick<MissionProfile, 'perigee' | 'apogee' | 'inclination'>> = {
  LEO: { perigee: 450, apogee: 600, inclination: 51.6 },
  POLAR: { perigee: 600, apogee: 600, inclination: 90 },
  SSO: { perigee: 500, apogee: 800, inclination: ssoInclination(500, 800) },
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
      name: 'aperture.mission.v4',
      version: 4,
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
        return {
          ...current,
          mission: valid ? { ...DEFAULT_MISSION, ...m } : current.mission,
          globe: p?.globe ? { ...DEFAULT_GLOBE, ...p.globe, layers: { ...DEFAULT_GLOBE.layers, ...p.globe.layers } } : current.globe,
        }
      },
    }
  )
)