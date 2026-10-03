import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCircle, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { Pause, Play } from 'lucide-react'
import {
  groundTrackFromPoint,
  orbitalPeriod,
  visibilityRadius,
  type GroundTrackPoint,
  type LaunchSite,
  type LaunchWindow,
} from '@aperture/orbital-core'
import { LAND_110M, nightBands, trackToMultiLine, trajectoryLine } from '@/lib/geo'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Form'
import { fmt } from '@/lib/format'

const SPEEDS = [
  { value: '60', label: '60×' },
  { value: '300', label: '300×' },
  { value: '1200', label: '1200×' },
] as const

const VIEWS = [
  { value: 'follow', label: 'Follow' },
  { value: 'site', label: 'Launch site' },
] as const

type Speed = (typeof SPEEDS)[number]['value']
type View = (typeof VIEWS)[number]['value']

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Position on the precomputed ground track at `sec` seconds after insertion */
function sample(track: GroundTrackPoint[], stepSec: number, sec: number): GroundTrackPoint {
  const i = Math.min(track.length - 2, Math.max(0, Math.floor(sec / stepSec)))
  const a = track[i]!
  const b = track[i + 1]!
  const f = Math.min(1, Math.max(0, (sec - i * stepSec) / stepSec))
  let dLon = b.longitude - a.longitude
  if (dLon > 180) dLon -= 360
  if (dLon < -180) dLon += 360
  return {
    time: new Date(a.time.getTime() + f * stepSec * 1000),
    latitude: a.latitude + (b.latitude - a.latitude) * f,
    longitude: ((a.longitude + dLon * f + 540) % 360) - 180,
  }
}

interface OrbitGlobeProps {
  site: LaunchSite
  window: LaunchWindow
  altitude: number
  inclination: number
  orbits?: number
}

/** Animated orthographic globe: ascent, insertion and the first orbits' ground track */
export default function OrbitGlobe({ site, window, altitude, inclination, orbits = 3 }: OrbitGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [speed, setSpeed] = useState<Speed>('300')
  const [view, setView] = useState<View>('follow')
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)

  const STEP = 20
  const periodSec = orbitalPeriod(altitude)
  const totalSec = periodSec * orbits

  const track = useMemo(
    () =>
      groundTrackFromPoint({
        altitudeKm: altitude,
        inclinationDeg: inclination,
        latitude: window.insertion.latitude,
        longitude: window.insertion.longitude,
        branch: window.branch,
        epoch: window.insertion.time,
        durationSec: totalSec,
        stepSec: STEP,
      }),
    [altitude, inclination, window, totalSec]
  )
  const trackLine = useMemo(() => trackToMultiLine(track), [track])
  const ascentLine = useMemo(() => trajectoryLine(window.trajectory), [window])
  const footprintKm = useMemo(() => visibilityRadius(altitude, 10), [altitude])

  // Restart the simulation when the mission changes
  useEffect(() => {
    elapsedRef.current = 0
    setElapsed(0)
  }, [track])

  // Animation clock
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      elapsedRef.current = (elapsedRef.current + dt * Number(speed)) % totalSec
      // Throttle React state updates (readouts) to ~10 Hz; canvas redraws every frame
      if (now - lastUi > 100) {
        setElapsed(elapsedRef.current)
        lastUi = now
      }
      draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, totalSec, track, view])

  function draw() {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const size = container.clientWidth
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1)
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const sat = sample(track, STEP, elapsedRef.current)
    const center = view === 'follow' ? [sat.longitude, sat.latitude * 0.6] : [site.longitude, site.latitude * 0.6]
    const projection = geoOrthographic()
      .translate([size / 2, size / 2])
      .scale(size / 2 - 6)
      .rotate([-center[0]!, -center[1]!])
      .clipAngle(90)
    const path = geoPath(projection, ctx)
    const stroke = (obj: GeoPermissibleObjects, color: string, width: number, dash: number[] = []) => {
      ctx.beginPath()
      path(obj)
      ctx.setLineDash(dash)
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
      ctx.setLineDash([])
    }
    const fill = (obj: GeoPermissibleObjects, color: string) => {
      ctx.beginPath()
      path(obj)
      ctx.fillStyle = color
      ctx.fill()
    }

    // Atmosphere glow + ocean
    const r = size / 2 - 6
    const glow = ctx.createRadialGradient(size / 2, size / 2, r * 0.9, size / 2, size / 2, r * 1.04)
    glow.addColorStop(0, 'rgba(56,189,248,0.25)')
    glow.addColorStop(1, 'rgba(56,189,248,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, size, size)
    fill({ type: 'Sphere' }, '#0a1a33')
    stroke(geoGraticule10(), 'rgba(148,163,184,0.12)', 0.6)
    fill(LAND_110M, '#1c3354')
    stroke(LAND_110M, 'rgba(125,160,210,0.35)', 0.5)
    for (const band of nightBands(sat.time)) fill(band, 'rgba(0,3,10,0.32)')

    stroke(trackLine, 'rgba(167,139,250,0.85)', 1.4, [4, 3])
    stroke(ascentLine, '#38bdf8', 2.5)
    fill(geoCircle().center([sat.longitude, sat.latitude]).radius((footprintKm / 6371) * (180 / Math.PI))(), 'rgba(56,189,248,0.12)')

    const dot = (lon: number, lat: number, radius: number, color: string) => {
      // clipAngle(90) drops points on the far hemisphere, so hidden markers draw nothing
      ctx.beginPath()
      path.pointRadius(radius)({ type: 'Point', coordinates: [lon, lat] })
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#020617'
      ctx.stroke()
    }
    dot(site.longitude, site.latitude, 5, '#22c55e')
    dot(window.insertion.longitude, window.insertion.latitude, 4, '#a78bfa')
    dot(sat.longitude, sat.latitude, 6, '#f8fafc')

    // Limb
    stroke({ type: 'Sphere' }, 'rgba(148,163,184,0.35)', 1)
  }

  // Redraw when paused (resize, mission change, view change)
  useEffect(() => {
    draw()
    const ro = new ResizeObserver(() => draw())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, view, playing])

  const sat = sample(track, STEP, elapsed)
  const orbitNo = Math.floor(elapsed / periodSec) + 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Segmented label="Simulation speed" value={speed} options={SPEEDS} onChange={setSpeed} className="w-44" />
        <Segmented label="Camera" value={view} options={VIEWS} onChange={setView} className="w-48" />
      </div>

      <div ref={containerRef} className="mx-auto aspect-square w-full max-w-[560px]">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          role="img"
          aria-label={`Globe showing ascent from ${site.name} and ${orbits} orbits of ground track at ${altitude} km, ${inclination.toFixed(1)}° inclination.`}
        />
      </div>

      <dl className="tabular grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg border bg-background/40 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Since insertion</dt>
          <dd className="font-mono font-semibold">{fmt.duration(elapsed)}</dd>
        </div>
        <div className="rounded-lg border bg-background/40 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Orbit</dt>
          <dd className="font-semibold">
            {orbitNo} / {orbits}
          </dd>
        </div>
        <div className="rounded-lg border bg-background/40 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Sub-satellite</dt>
          <dd className="font-semibold">
            {fmt.lat(sat.latitude)} {fmt.lon(sat.longitude)}
          </dd>
        </div>
        <div className="rounded-lg border bg-background/40 px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Sim time</dt>
          <dd className="font-semibold">{fmt.utcTime(sat.time)}</dd>
        </div>
      </dl>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-go" /> Launch site</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-sky-400" /> Ascent</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rotate-45 bg-violet-400" /> Insertion</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-0 w-4 border-t border-dashed border-violet-400" /> Ground track</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-sky-400/30" /> Coverage (10° elev.)</li>
      </ul>
    </div>
  )
}
