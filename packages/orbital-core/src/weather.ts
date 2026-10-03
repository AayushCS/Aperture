/**
 * Launch weather assessment.
 *
 * Evaluates simplified launch-commit criteria (surface wind, gusts, lightning
 * potential, precipitation and thick cloud) against either supplied hourly
 * forecast data or a deterministic climatological model of the launch site.
 */
import { localSolarTime } from './astro'
import { clamp, seededRandom, smoothstep } from './math'
import type {
  ClimateZone,
  HourlyWeather,
  LaunchSite,
  WeatherAssessment,
  WeatherFactor,
  WeatherRisk,
} from './types'

/** Simplified launch-commit limits (representative of medium-lift vehicles) */
export const WEATHER_LIMITS = {
  windSpeedKt: 30,
  windGustKt: 38,
  cloudCover: 85,
  precipitationProbability: 60,
  cape: 1500,
} as const

/** Violation-probability thresholds for Green / Yellow / Red */
export const RISK_THRESHOLDS = { medium: 0.2, high: 0.45 } as const

export function riskFromProbability(p: number): WeatherRisk {
  if (p >= RISK_THRESHOLDS.high) return 'high'
  if (p >= RISK_THRESHOLDS.medium) return 'medium'
  return 'low'
}

const THUNDERSTORM_CODES = new Set([95, 96, 99])
const HEAVY_PRECIP_CODES = new Set([65, 67, 75, 82, 86])

function factor(
  name: string,
  value: number,
  unit: string,
  limit: number,
  probability: number
): WeatherFactor {
  return {
    name,
    value: Math.round(value * 10) / 10,
    unit,
    limit,
    probability,
    status: probability >= 0.5 ? 'nogo' : probability >= 0.2 ? 'watch' : 'go',
  }
}

/** Assess an hourly weather sample against launch-commit criteria */
export function assessWeather(sample: HourlyWeather, source: WeatherAssessment['source']): WeatherAssessment {
  const L = WEATHER_LIMITS
  const thunder = sample.weatherCode !== undefined && THUNDERSTORM_CODES.has(sample.weatherCode)
  const cape = sample.cape ?? 0

  const factors: WeatherFactor[] = [
    factor('Surface wind', sample.windSpeedKt, 'kt', L.windSpeedKt, smoothstep(L.windSpeedKt * 0.7, L.windSpeedKt * 1.1, sample.windSpeedKt)),
    factor('Wind gusts', sample.windGustKt, 'kt', L.windGustKt, smoothstep(L.windGustKt * 0.7, L.windGustKt * 1.1, sample.windGustKt)),
    factor(
      'Lightning potential',
      thunder ? 100 : clamp((cape / L.cape) * 60, 0, 100),
      '%',
      50,
      thunder ? 0.95 : smoothstep(L.cape * 0.4, L.cape * 1.3, cape)
    ),
    factor(
      'Precipitation',
      sample.precipitationProbability,
      '%',
      L.precipitationProbability,
      clamp(
        smoothstep(25, 85, sample.precipitationProbability) +
          (sample.weatherCode !== undefined && HEAVY_PRECIP_CODES.has(sample.weatherCode) ? 0.3 : 0),
        0,
        1
      )
    ),
    factor('Cloud cover', sample.cloudCover, '%', L.cloudCover, smoothstep(60, 100, sample.cloudCover) * 0.5),
  ]

  // Probability that at least one rule is violated (factors treated as independent)
  const violationProbability = 1 - factors.reduce((acc, f) => acc * (1 - f.probability), 1)
  const p = Math.round(violationProbability * 1000) / 1000

  return { risk: riskFromProbability(p), violationProbability: p, factors, source, sample }
}

interface ClimateProfile {
  /** Mean surface wind by month (kt) */
  wind: readonly number[]
  /** Mean cloud cover by month (%) */
  cloud: readonly number[]
  /** Peak-afternoon convective (thunderstorm) potential by month, 0–1 */
  convection: readonly number[]
  /** Hour (local solar) of the convective peak */
  convectionPeak: number
  /** Morning marine-layer / fog cloud boost (%) */
  morningFog: number
}

// Monthly climatologies, Jan..Dec (representative values)
const CLIMATE: Record<ClimateZone, ClimateProfile> = {
  'subtropical-coastal': {
    wind: [11, 12, 12, 11, 10, 8, 7, 7, 9, 11, 11, 11],
    cloud: [40, 40, 38, 35, 40, 55, 60, 60, 58, 48, 42, 40],
    convection: [0.05, 0.06, 0.1, 0.12, 0.3, 0.65, 0.75, 0.72, 0.55, 0.2, 0.06, 0.05],
    convectionPeak: 15.5,
    morningFog: 5,
  },
  'mediterranean-coastal': {
    wind: [9, 10, 12, 13, 13, 12, 10, 9, 9, 9, 9, 9],
    cloud: [45, 45, 42, 38, 45, 55, 60, 58, 45, 38, 40, 45],
    convection: [0.04, 0.04, 0.03, 0.02, 0.01, 0, 0, 0, 0.01, 0.02, 0.03, 0.04],
    convectionPeak: 14,
    morningFog: 30,
  },
  continental: {
    wind: [13, 14, 15, 15, 14, 13, 12, 12, 12, 13, 14, 13],
    cloud: [65, 62, 58, 48, 40, 30, 25, 22, 28, 45, 60, 66],
    convection: [0, 0, 0.02, 0.05, 0.12, 0.18, 0.15, 0.1, 0.05, 0.02, 0, 0],
    convectionPeak: 16,
    morningFog: 5,
  },
  equatorial: {
    wind: [9, 9, 8, 7, 6, 7, 8, 9, 10, 10, 9, 9],
    cloud: [70, 72, 74, 76, 78, 70, 60, 50, 45, 48, 58, 66],
    convection: [0.45, 0.5, 0.55, 0.6, 0.6, 0.45, 0.3, 0.2, 0.15, 0.2, 0.3, 0.4],
    convectionPeak: 15,
    morningFog: 0,
  },
  'temperate-maritime': {
    wind: [14, 14, 14, 13, 12, 11, 11, 11, 12, 13, 14, 14],
    cloud: [60, 58, 58, 60, 62, 64, 62, 60, 60, 60, 60, 60],
    convection: [0.08, 0.06, 0.05, 0.04, 0.03, 0.03, 0.03, 0.04, 0.06, 0.08, 0.08, 0.08],
    convectionPeak: 15,
    morningFog: 10,
  },
}

/** Infer a climate zone from latitude when the site does not specify one */
export function inferClimateZone(latitude: number): ClimateZone {
  const a = Math.abs(latitude)
  if (a < 12) return 'equatorial'
  if (a < 32) return 'subtropical-coastal'
  if (a < 40) return 'mediterranean-coastal'
  return 'continental'
}

/**
 * Deterministic climatological weather estimate for a site and time.
 * Day-to-day variability is seeded from the date so results are reproducible.
 */
export function climatologicalWeather(site: LaunchSite, time: Date): HourlyWeather {
  const profile = CLIMATE[site.climate ?? inferClimateZone(site.latitude)]
  // Seasons are inverted in the southern hemisphere
  const month = (time.getUTCMonth() + (site.latitude < 0 ? 6 : 0)) % 12
  const hour = localSolarTime(time, site.longitude)
  const dayKey = `${site.name}|${time.toISOString().slice(0, 10)}`
  const hourKey = `${dayKey}|${Math.floor(hour)}`

  // Synoptic (day-scale) and local (hour-scale) noise, both in [-1, 1]
  const synoptic = seededRandom(dayKey) * 2 - 1
  const local = seededRandom(hourKey) * 2 - 1

  const diurnalWind = 1 + 0.25 * Math.cos(((hour - 14) / 24) * 2 * Math.PI)
  const windSpeedKt = Math.max(0, profile.wind[month]! * diurnalWind * (1 + 0.35 * synoptic + 0.1 * local))
  const windGustKt = windSpeedKt * (1.35 + 0.15 * Math.abs(local))

  const convectiveShape = Math.exp(-(((hour - profile.convectionPeak) / 3) ** 2))
  const convection = clamp(profile.convection[month]! * convectiveShape * (1 + 0.6 * synoptic), 0, 1)
  const fog = hour >= 4 && hour <= 10 ? profile.morningFog : 0

  const cloudCover = clamp(profile.cloud[month]! + fog + 25 * synoptic + 10 * local + 30 * convection, 0, 100)
  const precipitationProbability = clamp(80 * convection + Math.max(0, synoptic) * 25, 0, 100)
  const cape = 2200 * convection
  const weatherCode = convection > 0.6 ? 95 : precipitationProbability > 50 ? 80 : cloudCover > 70 ? 3 : cloudCover > 30 ? 2 : 0

  return {
    time,
    windSpeedKt,
    windGustKt,
    cloudCover,
    precipitationProbability,
    cape,
    weatherCode,
  }
}

/** Pick the forecast sample nearest to `time` (within 90 minutes) */
export function nearestForecast(forecast: readonly HourlyWeather[] | undefined, time: Date): HourlyWeather | undefined {
  if (!forecast?.length) return undefined
  let best: HourlyWeather | undefined
  let bestDelta = Infinity
  for (const sample of forecast) {
    const delta = Math.abs(sample.time.getTime() - time.getTime())
    if (delta < bestDelta) {
      best = sample
      bestDelta = delta
    }
  }
  return bestDelta <= 90 * 60 * 1000 ? best : undefined
}

/** Assess weather at a time, preferring forecast data and falling back to climatology */
export function weatherAt(
  site: LaunchSite,
  time: Date,
  forecast?: readonly HourlyWeather[]
): WeatherAssessment {
  const sample = nearestForecast(forecast, time)
  return sample
    ? assessWeather(sample, 'forecast')
    : assessWeather(climatologicalWeather(site, time), 'climatology')
}
