/**
 * Orbit traffic: catalogued objects that share the target altitude shell and
 * inclination. Works on CelesTrak GP (OMM JSON) records; perigee and apogee are
 * derived from mean motion and eccentricity.
 */
import { EARTH_RADIUS_KM, MU_EARTH, SECONDS_PER_DAY } from './constants'

/** The subset of a CelesTrak GP (OMM JSON) record the traffic model uses */
export interface GpRecord {
  OBJECT_NAME: string
  OBJECT_ID?: string
  NORAD_CAT_ID: number
  EPOCH: string
  /** rev/day */
  MEAN_MOTION: number
  ECCENTRICITY: number
  /** deg */
  INCLINATION: number
}

export interface TrafficObject {
  name: string
  noradId: number
  epoch: Date
  inclination: number
  /** km above the equatorial radius */
  perigee: number
  apogee: number
  /** Semi-major axis minus Earth radius (km) */
  meanAltitude: number
}

export interface OrbitTraffic {
  /** Objects in the catalogue */
  total: number
  /** Objects whose perigee–apogee range overlaps the shell and whose inclination is within tolerance */
  matches: number
  /** Matching objects nearest the target altitude, closest first */
  closest: TrafficObject[]
  /** Median element-set epoch — how current the catalogue is (robust to predictive, future-dated sets) */
  medianEpoch?: Date
}

export const DEFAULT_TRAFFIC_TOLERANCE = { altitudeKm: 25, inclinationDeg: 2, limit: 10 } as const

/** Semi-major axis (km) from mean motion (rev/day) */
export function semiMajorAxisFromMeanMotion(revPerDay: number): number {
  const n = (revPerDay * 2 * Math.PI) / SECONDS_PER_DAY
  return Math.cbrt(MU_EARTH / (n * n))
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Validate an untrusted GP record and derive its altitude range; null if unusable */
export function parseGpRecord(raw: unknown): TrafficObject | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<GpRecord>
  if (typeof r.OBJECT_NAME !== 'string' || !isNum(r.NORAD_CAT_ID) || typeof r.EPOCH !== 'string') return null
  if (!isNum(r.MEAN_MOTION) || r.MEAN_MOTION <= 0 || !isNum(r.ECCENTRICITY) || r.ECCENTRICITY < 0 || r.ECCENTRICITY >= 1) return null
  if (!isNum(r.INCLINATION)) return null

  // CelesTrak epochs are UTC without a zone designator
  const epoch = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(r.EPOCH) ? r.EPOCH : `${r.EPOCH}Z`)
  if (Number.isNaN(epoch.getTime())) return null

  const a = semiMajorAxisFromMeanMotion(r.MEAN_MOTION)
  return {
    name: r.OBJECT_NAME.trim(),
    noradId: r.NORAD_CAT_ID,
    epoch,
    inclination: r.INCLINATION,
    perigee: a * (1 - r.ECCENTRICITY) - EARTH_RADIUS_KM,
    apogee: a * (1 + r.ECCENTRICITY) - EARTH_RADIUS_KM,
    meanAltitude: a - EARTH_RADIUS_KM,
  }
}

/** Count and rank objects sharing the target shell (altitude ± tolerance) and inclination (± tolerance) */
export function orbitTraffic(
  objects: readonly TrafficObject[],
  target: { altitude: number; inclination: number },
  options: { altitudeKm?: number; inclinationDeg?: number; limit?: number } = {}
): OrbitTraffic {
  const altTol = options.altitudeKm ?? DEFAULT_TRAFFIC_TOLERANCE.altitudeKm
  const incTol = options.inclinationDeg ?? DEFAULT_TRAFFIC_TOLERANCE.inclinationDeg
  const limit = options.limit ?? DEFAULT_TRAFFIC_TOLERANCE.limit
  const low = target.altitude - altTol
  const high = target.altitude + altTol

  const matching = objects.filter(
    (o) => o.perigee <= high && o.apogee >= low && Math.abs(o.inclination - target.inclination) <= incTol
  )
  const distance = (o: TrafficObject) => Math.abs(o.meanAltitude - target.altitude)
  const closest = [...matching].sort((x, y) => distance(x) - distance(y) || x.noradId - y.noradId).slice(0, limit)

  const epochs = objects.map((o) => o.epoch.getTime()).sort((x, y) => x - y)
  const median = epochs[Math.floor(epochs.length / 2)]

  return {
    total: objects.length,
    matches: matching.length,
    closest,
    medianEpoch: median === undefined ? undefined : new Date(median),
  }
}
