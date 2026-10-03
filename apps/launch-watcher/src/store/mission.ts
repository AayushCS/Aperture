import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COMMON_VEHICLES,
  HYPOTHETICAL_MISSION_TLE,
  elementsToTle,
  parseTle,
  tleToElements,
  tleToText,
  type OrbitalElements,
  type VehicleId,
  type WeatherRisk,
} from '@aperture/orbital-core'

/**
 * The mission is one orbit, and its single source of truth is the TLE text.
 * Element edits are written back into the TLE (checksums regenerated).
 * Only valid TLEs are ever committed to the store.
 */
export interface MissionProfile {
  name: string
  tle: string
  vehicleId: VehicleId
  /** Search start, YYYY-MM-DD (UTC). Empty = now */
  startDate: string
  spanDays: number
  daylightOnly: boolean
  maxWeatherRisk: WeatherRisk
}

export type GlobeLayer = 'terminator' | 'graticule' | 'track' | 'ring' | 'footprint' | 'catalog' | 'ascent' | 'labels'

export interface GlobeSettings {
  layers: Record<GlobeLayer, boolean>
  revolutions: number
  speed: number
}

export const DEFAULT_MISSION: MissionProfile = {
  name: 'APERTURE-1 · first light',
  tle: HYPOTHETICAL_MISSION_TLE,
  vehicleId: 'SPECTRUM',
  // First orbital season at Spaceport Nova Scotia; also the TLE epoch
  startDate: '2027-12-01',
  spanDays: 14,
  daylightOnly: false,
  maxWeatherRisk: 'high',
}

export const DEFAULT_GLOBE: GlobeSettings = {
  layers: { terminator: true, graticule: true, track: true, ring: true, footprint: true, catalog: true, ascent: true, labels: true },
  revolutions: 1,
  speed: 300,
}

interface MissionState {
  mission: MissionProfile
  globe: GlobeSettings
  selectedWindowId: string | null
  /** Satellite inspector dialog: 'mission' or a catalog NORAD id */
  inspecting: string | null
  update: (patch: Partial<MissionProfile>) => void
  /** Commit TLE text; returns validation errors (nothing is stored on error) */
  setTle: (text: string) => string[]
  /** Edit elements; the TLE is regenerated keeping its identification fields */
  setElements: (patch: Partial<OrbitalElements>) => void
  setGlobe: (patch: Partial<GlobeSettings>) => void
  toggleLayer: (layer: GlobeLayer) => void
  selectWindow: (id: string | null) => void
  inspect: (id: string | null) => void
  reset: () => void
}

export const useMissionStore = create<MissionState>()(
  persist(
    (set, get) => ({
      mission: DEFAULT_MISSION,
      globe: DEFAULT_GLOBE,
      selectedWindowId: null,
      inspecting: null,
      update: (patch) => set((s) => ({ mission: { ...s.mission, ...patch }, selectedWindowId: null })),
      setTle: (text) => {
        const r = parseTle(text)
        if (!r.ok) return r.errors
        set((s) => ({ mission: { ...s.mission, tle: tleToText(r.tle) }, selectedWindowId: null }))
        return []
      },
      setElements: (patch) => {
        const r = parseTle(get().mission.tle)
        if (!r.ok) return
        const { tle } = r
        const next = elementsToTle({ ...tleToElements(tle), ...patch }, tle)
        set((s) => ({ mission: { ...s.mission, tle: tleToText(next) }, selectedWindowId: null }))
      },
      setGlobe: (patch) => set((s) => ({ globe: { ...s.globe, ...patch } })),
      toggleLayer: (layer) => set((s) => ({ globe: { ...s.globe, layers: { ...s.globe.layers, [layer]: !s.globe.layers[layer] } } })),
      selectWindow: (id) => set({ selectedWindowId: id }),
      inspect: (id) => set({ inspecting: id }),
      reset: () => set({ mission: DEFAULT_MISSION, globe: DEFAULT_GLOBE, selectedWindowId: null }),
    }),
    {
      name: 'aperture.mission.v3',
      version: 3,
      partialize: (s) => ({ mission: s.mission, globe: s.globe }),
      // Guard against stale or tampered storage
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<MissionState, 'mission' | 'globe'>> | undefined
        const m = p?.mission
        const valid = m && typeof m.tle === 'string' && parseTle(m.tle).ok && m.vehicleId in COMMON_VEHICLES
        return {
          ...current,
          mission: valid ? { ...DEFAULT_MISSION, ...m } : current.mission,
          globe: p?.globe ? { ...DEFAULT_GLOBE, ...p.globe, layers: { ...DEFAULT_GLOBE.layers, ...p.globe.layers } } : current.globe,
        }
      },
    }
  )
)