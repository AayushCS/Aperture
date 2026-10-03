import { useQuery } from '@tanstack/react-query'
import type { HourlyWeather, LaunchSite } from '@aperture/orbital-core'

interface OpenMeteoResponse {
  hourly?: {
    time: number[]
    wind_speed_10m: Array<number | null>
    wind_gusts_10m: Array<number | null>
    cloud_cover: Array<number | null>
    precipitation_probability: Array<number | null>
    cape: Array<number | null>
    weather_code: Array<number | null>
  }
}

/**
 * Hourly 16-day forecast from Open-Meteo (free, no API key).
 * Only the public coordinates of the launch site are sent.
 * On failure the engine transparently falls back to its climatology model.
 */
async function fetchForecast(site: LaunchSite): Promise<HourlyWeather[]> {
  const params = new URLSearchParams({
    latitude: site.latitude.toFixed(3),
    longitude: site.longitude.toFixed(3),
    hourly: 'wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation_probability,cape,weather_code',
    wind_speed_unit: 'kn',
    timezone: 'GMT',
    timeformat: 'unixtime',
    forecast_days: '16',
  })
  // A timeout (rather than React Query's unmount signal) avoids cancelling the shared request on remount
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`)
  const body = (await res.json()) as OpenMeteoResponse
  const h = body.hourly
  if (!h || !Array.isArray(h.time)) throw new Error('Unexpected forecast format')

  const out: HourlyWeather[] = []
  h.time.forEach((t, i) => {
    const wind = h.wind_speed_10m[i]
    const cloud = h.cloud_cover[i]
    // Skip hours the model has not populated yet
    if (typeof t !== 'number' || wind == null || cloud == null) return
    out.push({
      time: new Date(t * 1000),
      windSpeedKt: wind,
      windGustKt: h.wind_gusts_10m[i] ?? wind * 1.4,
      cloudCover: cloud,
      precipitationProbability: h.precipitation_probability[i] ?? 0,
      cape: h.cape[i] ?? 0,
      weatherCode: h.weather_code[i] ?? undefined,
    })
  })
  return out
}

export function useForecast(site: LaunchSite) {
  return useQuery({
    queryKey: ['forecast', site.latitude, site.longitude],
    queryFn: () => fetchForecast(site),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 2,
  })
}
