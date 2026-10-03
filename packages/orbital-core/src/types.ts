import { z } from 'zod'

/** Orbit class inferred from the elements (never chosen by hand) */
export type OrbitClass = 'LEO' | 'POLAR' | 'SSO' | 'MEO' | 'GEO' | 'HEO'

export type WeatherRisk = 'low' | 'medium' | 'high'

export type ClimateZone =
  | 'subtropical-coastal'
  | 'mediterranean-coastal'
  | 'continental'
  | 'equatorial'
  | 'temperate-maritime'
  | 'north-atlantic-coastal'

/**
 * Mean Keplerian elements of a single (possibly elliptical) orbit.
 * Brouwer mean elements, propagated with two-body motion plus J2 secular rates.
 * Usually obtained from a TLE via `tleToElements`.
 */
export interface OrbitalElements {
  epoch: Date
  /** km */
  semiMajorAxis: number
  /** 0 ≤ e < 1 */
  eccentricity: number
  /** deg */
  inclination: number
  /** Right ascension of the ascending node at epoch (deg) */
  raan: number
  /** Argument of perigee (deg) */
  argOfPerigee: number
  /** Mean anomaly at epoch (deg) */
  meanAnomaly: number
}

/** Launch site */
export interface LaunchSite {
  /** Stable identifier, e.g. "SPACEPORT_NOVA_SCOTIA" */
  id?: string
  name: string
  latitude: number
  longitude: number
  /** metres above sea level */
  altitude: number
  /**
   * Permitted flight azimuth corridors (deg from north, [from, to], clockwise).
   * Range-safety limits; omit to allow any azimuth.
   */
  azimuthCorridors?: ReadonlyArray<readonly [number, number]>
  climate?: ClimateZone
  /** First date orbital launches are expected to be possible; earlier searches are flagged */
  operationalFrom?: Date
}

/** Launch vehicle */
export interface VehicleParams {
  id?: string
  name: string
  /** Seconds from liftoff to orbit insertion */
  ascentDuration: number
  minInclination: number
  maxInclination: number
  /** Maximum apogee altitude for the payload class (km) */
  maxAltitude?: number
  /** Home launch site (informational) */
  launchSite?: LaunchSite
}

/** Hourly weather sample (forecast or climatology) */
export interface HourlyWeather {
  time: Date
  windSpeedKt: number
  windGustKt: number
  /** % */
  cloudCover: number
  /** % */
  precipitationProbability: number
  /** Convective available potential energy (J/kg) */
  cape?: number
  /** WMO weather code */
  weatherCode?: number
}

export interface WeatherFactor {
  name: string
  value: number
  unit: string
  limit: number
  /** Probability this factor violates its launch-commit rule (0–1) */
  probability: number
  status: 'go' | 'watch' | 'nogo'
}

export interface WeatherAssessment {
  risk: WeatherRisk
  /** Probability of a weather violation (0–1) */
  violationProbability: number
  factors: WeatherFactor[]
  source: 'forecast' | 'climatology'
  sample: HourlyWeather
}

export type VisibilityQuality = 'high' | 'medium' | 'low'

/** Geographic region from which the ascent is visible */
export interface GeoRegion {
  latitude: number
  longitude: number
  /** km */
  radius: number
  visibilityStart: Date
  visibilityEnd: Date
  quality?: VisibilityQuality
  label?: string
}

export interface TrajectoryPoint {
  /** Seconds after liftoff */
  t: number
  latitude: number
  longitude: number
  /** km */
  altitude: number
  /** km */
  downrange: number
}

export type LightingCondition = 'day' | 'twilight' | 'night'

export interface LightingInfo {
  condition: LightingCondition
  /** Sun elevation at the pad at liftoff (deg) */
  sunElevation: number
  /** Night/twilight sky with the plume lit by the Sun at altitude — the "jellyfish" effect */
  plumeSunlit: boolean
}

export interface ScoreBreakdown {
  weather: number
  performance: number
  corridor: number
  viewing: number
}

export type PassBranch = 'ascending' | 'descending'

/** Launch window result */
export interface LaunchWindow {
  id: string
  /** Window open */
  start: Date
  /** Window close */
  end: Date
  /** Ideal liftoff (in-plane) time */
  optimal: Date
  /** Window width (s) */
  duration: number
  /** Composite 0–1 score */
  quality: number
  scoreBreakdown: ScoreBreakdown
  weatherRisk: WeatherRisk
  weather: WeatherAssessment
  branch: PassBranch
  /** Flight azimuth relative to Earth (deg) */
  azimuth: number
  insertion: {
    time: Date
    latitude: number
    longitude: number
    /** km */
    altitude: number
    /** Position on the ellipse at insertion (deg, 0 = perigee) */
    trueAnomaly: number
  }
  /** As-flown mean elements at insertion (epoch = insertion time) */
  orbit: OrbitalElements
  lighting: LightingInfo
  visibilityRegions: GeoRegion[]
  trajectory: TrajectoryPoint[]
  /** Target plane RAAN at insertion (deg) */
  raan: number
}

export interface CalculationConstraints {
  minSunElevation?: number
  maxWeatherRisk?: WeatherRisk
  daylightOnly?: boolean
  /** Allowable RAAN error (deg) that defines the window width */
  raanTolerance?: number
}

/** Calculation inputs */
export interface CalculationInput {
  /**
   * The single target orbit. The plane (RAAN) is propagated from `orbit.epoch`
   * with J2; size, shape, inclination and argument of perigee are injection targets.
   */
  orbit: OrbitalElements
  vehicle?: VehicleParams
  dateRange: { start: Date; end: Date }
  launchSite: LaunchSite
  constraints?: CalculationConstraints
  /** Optional hourly forecast for the site; climatology is used outside its span */
  weather?: readonly HourlyWeather[]
}

export interface FeasibilityIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface LaunchOpportunity {
  branch: PassBranch
  /** Earth-relative flight azimuth (deg) */
  azimuth: number
  rotationalGain: number
  withinCorridor: boolean
  /** Altitude at insertion for this pass given the target argument of perigee (km) */
  insertionAltitude: number
  /** Argument of latitude at insertion (deg) — the argument of perigee that would inject at perigee */
  insertionArgumentOfLatitude: number
}

/** Pre-computation mission analysis */
export interface MissionAnalysis {
  feasible: boolean
  issues: FeasibilityIssue[]
  orbitClass: OrbitClass
  semiMajorAxisKm: number
  perigeeAltitudeKm: number
  apogeeAltitudeKm: number
  /** Anomalistic period including J2 (min) */
  periodMinutes: number
  revsPerDay: number
  perigeeVelocityKmS: number
  apogeeVelocityKmS: number
  nodalPrecessionDegDay: number
  apsidalPrecessionDegDay: number
  /** Inclination that would make this a, e sun-synchronous (deg) */
  sunSynchronousInclination: number
  sunSynchronous: boolean
  /** Local time of the ascending node at the orbit epoch (h) */
  ltan: number
  groundTrackShiftDeg: number
  opportunities: LaunchOpportunity[]
}

// ---------------------------------------------------------------------------
// Zod schemas for validating untrusted input (e.g. from URLs or files)
// ---------------------------------------------------------------------------

export const OrbitalElementsSchema = z.object({
  epoch: z.date(),
  semiMajorAxis: z.number().min(6378.137 + 100).max(500_000),
  eccentricity: z.number().min(0).lt(1),
  inclination: z.number().min(0).max(180),
  raan: z.number().min(0).max(360),
  argOfPerigee: z.number().min(0).max(360),
  meanAnomaly: z.number().min(0).max(360),
})

export const LaunchSiteSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(0),
  azimuthCorridors: z.array(z.tuple([z.number(), z.number()])).optional(),
  climate: z
    .enum([
      'subtropical-coastal',
      'mediterranean-coastal',
      'continental',
      'equatorial',
      'temperate-maritime',
      'north-atlantic-coastal',
    ])
    .optional(),
  operationalFrom: z.date().optional(),
})

export const VehicleParamsSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ascentDuration: z.number().positive(),
  maxInclination: z.number().min(0).max(180),
  minInclination: z.number().min(0).max(180),
  maxAltitude: z.number().positive().optional(),
  launchSite: LaunchSiteSchema.optional(),
})

export const CalculationInputSchema = z
  .object({
    orbit: OrbitalElementsSchema,
    vehicle: VehicleParamsSchema.optional(),
    dateRange: z.object({ start: z.date(), end: z.date() }),
    launchSite: LaunchSiteSchema,
    constraints: z
      .object({
        minSunElevation: z.number().min(-90).max(90).optional(),
        maxWeatherRisk: z.enum(['low', 'medium', 'high']).optional(),
        daylightOnly: z.boolean().optional(),
        raanTolerance: z.number().positive().max(10).optional(),
      })
      .optional(),
  })
  .refine((v) => v.dateRange.end > v.dateRange.start, {
    message: 'dateRange.end must be after dateRange.start',
    path: ['dateRange', 'end'],
  })