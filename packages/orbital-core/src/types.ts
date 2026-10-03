import { z } from 'zod'

/**
 * Orbital inclination types
 */
export type OrbitType = 'LEO' | 'POLAR' | 'SSO'

/**
 * Launch window result
 */
export interface LaunchWindow {
  start: Date
  end: Date
  duration: number // in seconds
  quality: number // 0-1 score
  weatherRisk: 'low' | 'medium' | 'high'
  visibilityRegions: GeoRegion[]
}

/**
 * Geographic region for visibility
 */
export interface GeoRegion {
  latitude: number
  longitude: number
  radius: number // km
  visibilityStart: Date
  visibilityEnd: Date
}

/**
 * Vehicle parameters
 */
export interface VehicleParams {
  name: string
  ascentDuration: number // seconds from liftoff to orbit insertion
  maxInclination: number // degrees
  minInclination: number // degrees
  launchSite: LaunchSite
}

/**
 * Launch site
 */
export interface LaunchSite {
  name: string
  latitude: number
  longitude: number
  altitude: number // meters
}

/**
 * Orbital parameters
 */
export interface OrbitalParams {
  type: OrbitType
  altitude: number // km
  inclination: number // degrees
  raan?: number // right ascension of ascending node (degrees)
  argOfPerigee?: number // argument of perigee (degrees)
  eccentricity?: number
}

/**
 * Calculation inputs
 */
export interface CalculationInput {
  orbit: OrbitalParams
  vehicle?: VehicleParams
  dateRange: {
    start: Date
    end: Date
  }
  launchSite: LaunchSite
  constraints?: {
    minSunElevation?: number // degrees
    maxWeatherRisk?: 'low' | 'medium' | 'high'
    daylightOnly?: boolean
  }
}

// Zod schemas for validation
export const OrbitTypeSchema = z.enum(['LEO', 'POLAR', 'SSO'])

export const OrbitalParamsSchema = z.object({
  type: OrbitTypeSchema,
  altitude: z.number().min(160).max(2000), // LEO range
  inclination: z.number().min(0).max(180),
  raan: z.number().min(0).max(360).optional(),
  argOfPerigee: z.number().min(0).max(360).optional(),
  eccentricity: z.number().min(0).max(0.1).optional(),
})

export const LaunchSiteSchema = z.object({
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(0),
})

export const VehicleParamsSchema = z.object({
  name: z.string(),
  ascentDuration: z.number().positive(),
  maxInclination: z.number().min(0).max(180),
  minInclination: z.number().min(0).max(180),
  launchSite: LaunchSiteSchema,
})

export const CalculationInputSchema = z.object({
  orbit: OrbitalParamsSchema,
  vehicle: VehicleParamsSchema.optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  launchSite: LaunchSiteSchema,
  constraints: z.object({
    minSunElevation: z.number().min(-90).max(90).optional(),
    maxWeatherRisk: z.enum(['low', 'medium', 'high']).optional(),
    daylightOnly: z.boolean().optional(),
  }).optional(),
})