import { useMemo } from 'react'
import { geoGraticule10, geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import type { LaunchSite, LaunchWindow, VisibilityQuality } from '@aperture/orbital-core'
import { nightBands, regionFeatures, trajectoryLine, useDetailedLand } from '@/lib/geo'
import { fmt } from '@/lib/format'

const WIDTH = 800
const HEIGHT = 460

export const QUALITY_META: Record<VisibilityQuality, { label: string; color: string }> = {
  high: { label: 'Excellent', color: '#22c55e' },
  medium: { label: 'Good', color: '#f59e0b' },
  low: { label: 'Marginal', color: '#f87171' },
}

/** Regional map of the ascent ground path and where spectators can see it */
export default function ViewingMap({ site, window }: { site: LaunchSite; window: LaunchWindow }) {
  const land = useDetailedLand()

  const layers = useMemo(() => {
    const regions = regionFeatures(window.visibilityRegions)
    const path = trajectoryLine(window.trajectory)
    const fit: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: [...regions, path] }
    const projection = geoMercator().fitExtent(
      [
        [24, 24],
        [WIDTH - 24, HEIGHT - 24],
      ],
      fit
    )
    const draw = geoPath(projection)
    const project = (lon: number, lat: number) => projection([lon, lat]) ?? [0, 0]

    return {
      land: draw(land) ?? '',
      graticule: draw(geoGraticule10()) ?? '',
      night: nightBands(window.optimal).map((b) => draw(b) ?? ''),
      regions: regions.map((r, i) => ({ d: draw(r) ?? '', region: window.visibilityRegions[i]! })),
      trajectory: draw(path) ?? '',
      site: project(site.longitude, site.latitude),
      insertion: project(window.insertion.longitude, window.insertion.latitude),
      ticks: window.trajectory
        .filter((p) => p.t > 0 && p.t % 120 === 0)
        .map((p) => ({ t: p.t, xy: project(p.longitude, p.latitude) })),
    }
  }, [land, site, window])

  // Paint outermost zones first so the prime zone sits on top
  const ordered = [...layers.regions].reverse()

  return (
    <figure className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-[#07101f]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full"
          role="img"
          aria-labelledby="viewing-map-title viewing-map-desc"
        >
          <title id="viewing-map-title">Ascent viewing map</title>
          <desc id="viewing-map-desc">
            Ascent ground path from {site.name} on azimuth {fmt.deg(window.azimuth)} to orbit insertion at{' '}
            {fmt.lat(window.insertion.latitude)} {fmt.lon(window.insertion.longitude)}, with{' '}
            {window.visibilityRegions.length} viewing zones.
          </desc>
          <path d={layers.graticule} fill="none" stroke="#1e2b44" strokeWidth={0.6} />
          <path d={layers.land} fill="#14223a" stroke="#2c4366" strokeWidth={0.7} />
          {layers.night.map((d, i) => (
            <path key={i} d={d} fill="#000510" fillOpacity={0.3} />
          ))}
          {ordered.map(({ d, region }) => (
            <path
              key={region.label}
              d={d}
              fill={QUALITY_META[region.quality ?? 'medium'].color}
              fillOpacity={0.1}
              stroke={QUALITY_META[region.quality ?? 'medium'].color}
              strokeOpacity={0.75}
              strokeWidth={1.2}
              strokeDasharray="5 4"
            />
          ))}
          <path d={layers.trajectory} fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" />
          {layers.ticks.map(({ t, xy }) => (
            <g key={t} transform={`translate(${xy[0]},${xy[1]})`}>
              <circle r={3} fill="#0b1220" stroke="#38bdf8" strokeWidth={1.5} />
              <text y={-8} textAnchor="middle" fontSize={11} fill="#93c5fd" className="tabular">
                T+{Math.round(t / 60)}m
              </text>
            </g>
          ))}
          <g transform={`translate(${layers.site[0]},${layers.site[1]})`}>
            <circle r={9} fill="#22c55e" fillOpacity={0.2} />
            <circle r={4.5} fill="#22c55e" stroke="#03110a" strokeWidth={1.5} />
            <text x={-12} y={18} textAnchor="end" fontSize={12} fontWeight={600} fill="#e2e8f0">
              {site.name}
            </text>
          </g>
          <g transform={`translate(${layers.insertion[0]},${layers.insertion[1]})`}>
            <rect x={-4.5} y={-4.5} width={9} height={9} transform="rotate(45)" fill="#a78bfa" stroke="#0b1220" strokeWidth={1.5} />
            <text x={10} y={4} fontSize={12} fill="#c4b5fd">
              Orbit insertion · T+{fmt.duration(window.trajectory.at(-1)?.t ?? 0)}
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-sky-400" /> Ascent ground path
        </span>
        {(['high', 'medium', 'low'] as const).map((q) => (
          <span key={q} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border border-dashed" style={{ borderColor: QUALITY_META[q].color }} />
            {QUALITY_META[q].label} visibility
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-black/50" /> Night side at liftoff
        </span>
      </figcaption>
    </figure>
  )
}
