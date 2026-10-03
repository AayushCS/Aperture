import { useEffect, useState } from 'react'
import { geoCircle } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, Polygon } from 'geojson'
import land110 from 'world-atlas/land-110m.json'
import { subsolarPoint, type GeoRegion, type TrajectoryPoint } from '@aperture/orbital-core'

type LandTopology = Topology<{ land: GeometryCollection }>

function toLand(topology: unknown): FeatureCollection<Geometry> {
  const t = topology as LandTopology
  return feature(t, t.objects.land) as FeatureCollection<Geometry>
}

/** Coarse world land (55 KB) — globe and world map */
export const LAND_110M = toLand(land110)

let land50Promise: Promise<FeatureCollection<Geometry>> | null = null

/** Detailed land (≈0.5 MB), lazily loaded for regional viewing maps */
export function useDetailedLand(): FeatureCollection<Geometry> {
  const [land, setLand] = useState<FeatureCollection<Geometry>>(LAND_110M)
  useEffect(() => {
    let active = true
    land50Promise ??= import('world-atlas/land-50m.json').then((m) => toLand(m.default))
    land50Promise.then((l) => active && setLand(l)).catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return land
}

/**
 * Night-side shading: nested circles centred on the anti-solar point.
 * Radii 90°, 84°, 78°, 72° ⇒ sunset, civil, nautical, astronomical twilight.
 */
export function nightBands(date: Date): Array<Feature<Polygon>> {
  const sun = subsolarPoint(date)
  const center: [number, number] = [sun.longitude + 180, -sun.latitude]
  return [90, 84, 78, 72].map((radius) => ({
    type: 'Feature',
    properties: { radius },
    geometry: geoCircle().center(center).radius(radius).precision(2)() as Polygon,
  }))
}

/** Circle on the Earth's surface (radius in km) as a GeoJSON polygon */
export function surfaceCircle(lat: number, lon: number, radiusKm: number): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: geoCircle().center([lon, lat]).radius((radiusKm / 6371) * (180 / Math.PI)).precision(3)() as Polygon,
  }
}

/** Split a longitude-wrapped track into line segments (avoids streaks across the map at ±180°) */
export function trackToMultiLine(points: ReadonlyArray<{ latitude: number; longitude: number }>): Feature<MultiLineString> {
  const lines: Array<Array<[number, number]>> = []
  let current: Array<[number, number]> = []
  let prevLon: number | null = null
  for (const p of points) {
    if (prevLon !== null && Math.abs(p.longitude - prevLon) > 180) {
      if (current.length > 1) lines.push(current)
      current = []
    }
    current.push([p.longitude, p.latitude])
    prevLon = p.longitude
  }
  if (current.length > 1) lines.push(current)
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } }
}

export function trajectoryLine(trajectory: readonly TrajectoryPoint[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: trajectory.map((p) => [p.longitude, p.latitude]) },
  }
}

export function regionFeatures(regions: readonly GeoRegion[]): Array<Feature<Polygon>> {
  return regions.map((r) => surfaceCircle(r.latitude, r.longitude, r.radius))
}
