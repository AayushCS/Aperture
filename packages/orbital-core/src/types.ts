import { z } from 'zod'

/** Target orbit family */
export type OrbitType = 'LEO' | 'POLAR' | 'SSO'

export type WeatherRisk = 'low' | 'medium' | 'high'

export type ClimateZone =
  | 'subtropical-coastal'
  | 'mediterranean-coastal'
  | 'continental'
  | 'equatorial'
  | 'temperate-maritime'

/** Launch site */
export interface LaunchSite {
  /** Stable identifier, e.g. "KSC" */
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
}

/** Launch vehicle */
export interface VehicleParams {
  id?: string
  name: string
  /** Seconds from liftoff to orbit insertion */
  ascentDuration: number
  minInclination: number
  maxInclination: number
  /** Maximum circular-orbit altitude for the payload class (km) */
  maxAltitude?: number
  /** Home launch site (informational) */
  launchSite?: LaunchSite
}

/** Target orbital parameters (circular orbits) */
export interface OrbitalParams {
  type: OrbitType
  /** km */
  altitude: number
  /** deg */
  inclination: number
  /**
   * Target right ascension of the ascending node (deg) at `raanEpoch`.
   * Used for LEO/POLAR (e.g. rendezvous with an existing plane). Defaults to 0.
   */
  raan?: number
  /** Epoch for `raan`; defaults to the start of the date range */
  raanEpoch?: Date
  /** Local time of the ascending node for SSO (decimal hours, default 22.5 → 10:30 descending) */
  ltan?: number
  argOfPerigee?: number
  eccentricity?: number
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
  branch: 'ascending' | 'descending'
  /** Flight azimuth relative to Earth (deg) */
  azimuth: number
  insertion: { time: Date; latitude: number; longitude: number }
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
  orbit: OrbitalParams
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

/** Pre-computation mission analysis */
export interface MissionAnalysis {
  feasible: boolean
  issues: FeasibilityIssue[]
  periodMinutes: number
  velocityKmS: number
  nodalPrecessionDegDay: number
  sunSynchronousInclination: number
  groundTrackShiftDeg: number
  opportunities: Array<{
    branch: 'ascending' | 'descending'
    azimuth: number
    rotationalGain: number
    withinCorridor: boolean
  }>
}

// ---------------------------------------------------------------------------
// Zod schemas for validating untrusted input (e.g. from URLs or files)
// ---------------------------------------------------------------------------

export const OrbitTypeSchema = z.enum(['LEO', 'POLAR', 'SSO'])

export const OrbitalParamsSchema = z.object({
  type: OrbitTypeSchema,
  altitude: z.number().min(160).max(2000),
  inclination: z.number().min(0).max(180),
  raan: z.number().min(0).max(360).optional(),
  raanEpoch: z.date().optional(),
  ltan: z.number().min(0).max(24).optional(),
  argOfPerigee: z.number().min(0).max(360).optional(),
  eccentricity: z.number().min(0).max(0.1).optional(),
})

export const LaunchSiteSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(0),
  azimuthCorridors: z.array(z.tuple([z.number(), z.number()])).optional(),
  climate: z
    .enum(['subtropical-coastal', 'mediterranean-coastal', 'continental', 'equatorial', 'temperate-maritime'])
    .optional(),
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
    orbit: OrbitalParamsSchema,
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
