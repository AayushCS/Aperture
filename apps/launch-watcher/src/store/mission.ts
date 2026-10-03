import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  ORBIT_ALTITUDE,
  clamp,
  maxApogeeAltitude,
  shapeFromApsides,
  sunSynchronousInclinationFor,
  type OrbitFamily,
  type VehicleId,
  type WeatherRisk,
} from '@aperture/orbital-core'

import { clampSpanDays, clampStartDate, startDateOrToday } from '@/lib/searchRange'

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

/**
 * Inclination range and default for the families where it is chosen (SSO's is computed).
 * LEO starts at Canso's latitude (45.3036°, shown as 45.3°): the lowest inclination
 * a direct ascent reaches, flown due east.
 */
const CANSO_LATITUDE = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA.latitude
export const ORBIT_LIMITS: Record<Exclude<OrbitFamily, 'SSO'>, { minInc: number; maxInc: number; defaultInc: number }> = {
  LEO: { minInc: CANSO_LATITUDE, maxInc: 60, defaultInc: CANSO_LATITUDE },
  POLAR: { minInc: 87.9, maxInc: 90, defaultInc: 89 },
}

const SITE_TZ = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA.timeZone

/** Keep the search inside today … today + 16 days (site calendar): start clamped, then span */
export function clampSearch(m: Pick<MissionProfile, 'startDate' | 'spanDays'>, now: Date = new Date()): Pick<MissionProfile, 'startDate' | 'spanDays'> {
  const startDate = clampStartDate(m.startDate, now, SITE_TZ)
  return { startDate, spanDays: clampSpanDays(startDate, m.spanDays, now, SITE_TZ) }
}

type OrbitShape = Pick<MissionProfile, 'perigee' | 'apogee' | 'inclination'>

/** Clamp an orbit to its family's ranges: perigee, perigee ≤ apogee ≤ ceiling, inclination (computed for SSO) */
export function normalizeOrbit(family: OrbitFamily, orbit: OrbitShape): OrbitShape {
  const alt = ORBIT_ALTITUDE[family]
  const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback)
  const perigee = clamp(finite(orbit.perigee, alt.defaultKm), alt.min, alt.max)
  const apogee = clamp(finite(orbit.apogee, perigee), perigee, maxApogeeAltitude(family, perigee))
  if (family === 'SSO') return { perigee, apogee, inclination: ssoInclination(perigee, apogee) }
  const { minInc, maxInc, defaultInc } = ORBIT_LIMITS[family]
  return { perigee, apogee, inclination: clamp(finite(orbit.inclination, defaultInc), minInc, maxInc) }
}

/** Starting point per family: circular at the default perigee */
const preset = (family: OrbitFamily): OrbitShape => {
  const alt = ORBIT_ALTITUDE[family].defaultKm
  return normalizeOrbit(family, { perigee: alt, apogee: alt, inclination: family === 'SSO' ? Number.NaN : ORBIT_LIMITS[family].defaultInc })
}
export const ORBIT_PRESETS: Record<OrbitFamily, OrbitShape> = {
  LEO: preset('LEO'),
  POLAR: preset('POLAR'),
  SSO: preset('SSO'),
}

export const DEFAULT_MISSION: MissionProfile = {
  name: 'APERTURE-1',
  orbitType: 'SSO',
  ...ORBIT_PRESETS.SSO,
  vehicleId: 'SPECTRUM',
  // Empty = today: the plane and search follow the clock (before operationalFrom the engine only warns)
  startDate: '',
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
          // Clamp to the family's ranges (keeping SSO exactly sun-synchronous) and to the forecast-length search range
          return { mission: { ...mission, ...normalizeOrbit(mission.orbitType, mission), ...clampSearch(mission) }, selectedWindowId: null }
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
          [m.perigee, m.apogee, m.inclination].every((v) => typeof v === 'number' && Number.isFinite(v))
        // Keep only known fields (older saves carried an editable RAAN / LTAN, now fixed) and clamp to current ranges
        let mission = current.mission
        if (valid) {
          const known = Object.fromEntries(Object.keys(DEFAULT_MISSION).map((k) => [k, m[k as keyof MissionProfile]]).filter(([, v]) => v !== undefined))
          mission = { ...DEFAULT_MISSION, ...known }
          // A saved date outside today … today + 16 goes back to today (not to the nearest limit)
          if (mission.startDate && startDateOrToday(mission.startDate, new Date(), SITE_TZ) !== mission.startDate) mission.startDate = ''
          mission = { ...mission, ...normalizeOrbit(mission.orbitType, mission), ...clampSearch(mission) }
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