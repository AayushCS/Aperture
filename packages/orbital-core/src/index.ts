/**
 * Aperture Orbital Core — launch window planning engine.
 */
import { OrbitalEngine } from './calculations'
import type { LaunchSite, OrbitType, VehicleParams } from './types'

/** Default altitude and the "Advanced" slider range per orbit family (km) */
export const ORBIT_ALTITUDE = {
  LEO: { defaultKm: 500, min: 300, max: 1200 },
  POLAR: { defaultKm: 700, min: 500, max: 1000 },
  SSO: { defaultKm: 600, min: 500, max: 900 },
} as const satisfies Record<OrbitType, { defaultKm: number; min: number; max: number }>

export { OrbitalEngine, nextWindow, corridorMargin, DEFAULT_LTAN, DEFAULT_RAAN_TOLERANCE, MAX_RANGE_DAYS } from './calculations'
export * from './math'
export * from './astro'
export * from './orbit'
export * from './trajectory'
export * from './weather'
export * from './traffic'
export * from './conjunction'
export * from './constants'
export * from './types'

/** Launch sites with approximate range-safety azimuth corridors */
export const COMMON_LAUNCH_SITES = {
  KSC: {
    id: 'KSC',
    name: 'Kennedy Space Center',
    latitude: 28.5729,
    longitude: -80.6489,
    altitude: 3,
    azimuthCorridors: [[35, 120]],
    climate: 'subtropical-coastal',
  },
  VANDENBERG: {
    id: 'VANDENBERG',
    name: 'Vandenberg Space Force Base',
    latitude: 34.742,
    longitude: -120.5724,
    altitude: 112,
    azimuthCorridors: [[145, 210]],
    climate: 'mediterranean-coastal',
  },
  BAIKONUR: {
    id: 'BAIKONUR',
    name: 'Baikonur Cosmodrome',
    latitude: 45.965,
    longitude: 63.305,
    altitude: 90,
    azimuthCorridors: [[30, 100]],
    climate: 'continental',
  },
  GUIANA: {
    id: 'GUIANA',
    name: 'Guiana Space Centre',
    latitude: 5.239,
    longitude: -52.768,
    altitude: 10,
    azimuthCorridors: [[349.5, 93.5]],
    climate: 'equatorial',
  },
  MAHIA: {
    id: 'MAHIA',
    name: 'Rocket Lab Launch Complex 1',
    latitude: -39.2627,
    longitude: 177.8647,
    altitude: 0,
    azimuthCorridors: [[20, 200]],
    climate: 'temperate-maritime',
  },
} as const satisfies Record<string, LaunchSite>

export type LaunchSiteId = keyof typeof COMMON_LAUNCH_SITES

/** Representative vehicles (ascent duration ≈ liftoff to first orbit insertion) */
export const COMMON_VEHICLES = {
  FALCON_9: {
    id: 'FALCON_9',
    name: 'Falcon 9',
    ascentDuration: 522,
    minInclination: 0,
    maxInclination: 140,
    maxAltitude: 2000,
    launchSite: COMMON_LAUNCH_SITES.KSC,
  },
  FALCON_HEAVY: {
    id: 'FALCON_HEAVY',
    name: 'Falcon Heavy',
    ascentDuration: 600,
    minInclination: 0,
    maxInclination: 140,
    maxAltitude: 2000,
    launchSite: COMMON_LAUNCH_SITES.KSC,
  },
  ATLAS_V: {
    id: 'ATLAS_V',
    name: 'Atlas V',
    ascentDuration: 660,
    minInclination: 0,
    maxInclination: 120,
    maxAltitude: 2000,
    launchSite: COMMON_LAUNCH_SITES.KSC,
  },
  SOYUZ_2: {
    id: 'SOYUZ_2',
    name: 'Soyuz-2',
    ascentDuration: 528,
    minInclination: 45,
    maxInclination: 100,
    maxAltitude: 1500,
    launchSite: COMMON_LAUNCH_SITES.BAIKONUR,
  },
  ELECTRON: {
    id: 'ELECTRON',
    name: 'Electron',
    ascentDuration: 540,
    minInclination: 37,
    maxInclination: 120,
    maxAltitude: 1200,
    launchSite: COMMON_LAUNCH_SITES.MAHIA,
  },
} as const satisfies Record<string, VehicleParams>

export type VehicleId = keyof typeof COMMON_VEHICLES

/** Shared engine instance */
export const orbitalEngine = new OrbitalEngine()
