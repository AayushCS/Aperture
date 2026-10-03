/**
 * Aperture Orbital Core — launch window planning engine.
 */
import { OrbitalEngine } from './calculations'
import type { LaunchSite, VehicleParams } from './types'

export {
  OrbitalEngine,
  nextWindow,
  corridorMargin,
  DEFAULT_RAAN_TOLERANCE,
  MAX_RANGE_DAYS,
  MIN_PERIGEE_KM,
  STALE_EPOCH_DAYS,
} from './calculations'
export * from './math'
export * from './astro'
export * from './elements'
export * from './orbit'
export * from './tle'
export * from './trajectory'
export * from './weather'
export * from './constants'
export * from './types'

/**
 * Spaceport Nova Scotia (Maritime Launch Services), ~3.5 km south of Canso.
 * Flights go east and south over open Atlantic, giving roughly 45°–98° inclinations.
 * The azimuth corridor is representative, not an official range rule. Orbital
 * operations are targeted for late 2027; `operationalFrom` reflects that assumption.
 */
export const COMMON_LAUNCH_SITES = {
  SPACEPORT_NOVA_SCOTIA: {
    id: 'SPACEPORT_NOVA_SCOTIA',
    name: 'Spaceport Nova Scotia',
    latitude: 45.3036,
    longitude: -60.9829,
    altitude: 10,
    azimuthCorridors: [[88, 200]],
    climate: 'north-atlantic-coastal',
    operationalFrom: new Date('2027-10-01T00:00:00Z'),
  },
} as const satisfies Record<string, LaunchSite>

export type LaunchSiteId = keyof typeof COMMON_LAUNCH_SITES

/** Small launchers associated with the site (representative performance figures) */
export const COMMON_VEHICLES = {
  SPECTRUM: {
    id: 'SPECTRUM',
    name: 'Isar Aerospace Spectrum',
    ascentDuration: 570,
    minInclination: 40,
    maxInclination: 110,
    maxAltitude: 1000,
    launchSite: COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA,
  },
  HANBIT_NANO: {
    id: 'HANBIT_NANO',
    name: 'Innospace HANBIT-Nano',
    ascentDuration: 600,
    minInclination: 40,
    maxInclination: 110,
    maxAltitude: 800,
    launchSite: COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA,
  },
  REFERENCE_SMALL: {
    id: 'REFERENCE_SMALL',
    name: 'Reference small launcher',
    ascentDuration: 540,
    minInclination: 0,
    maxInclination: 140,
    maxAltitude: 2000,
    launchSite: COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA,
  },
} as const satisfies Record<string, VehicleParams>

export type VehicleId = keyof typeof COMMON_VEHICLES

/**
 * Hypothetical mission target: APERTURE-1, a 500 × 800 km sun-synchronous
 * Earth-observation orbit (10:30 descending node) with its epoch at Spaceport
 * Nova Scotia's first orbital season. The argument of perigee is chosen so a
 * southbound launch from the spaceport injects at perigee. Not a real object;
 * catalog number 99901 is in the unassigned test range.
 */
export const HYPOTHETICAL_MISSION_TLE = `APERTURE-1
1 99901U 27999A   27335.00000000  .00000512  00000-0  21000-4 0    13
2 99901  97.9787  44.3125 0213428 151.5401   0.0000 14.72546665    10`

/** Shared engine instance */
export const orbitalEngine = new OrbitalEngine()