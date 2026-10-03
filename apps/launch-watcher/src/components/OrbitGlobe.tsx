import { useCallback, useEffect, useRef, useState } from 'react'
import { geoCircle, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { Crosshair, Expand, Layers, Minus, Pause, Play, Plus, RotateCcw, Shrink } from 'lucide-react'
import {
  EARTH_RADIUS_KM,
  anomalisticPeriod,
  gmst,
  orbitRing,
  propagate,
  visibilityRadius,
  type LaunchSite,
  type LaunchWindow,
  type OrbitalElements,
} from '@aperture/orbital-core'
import { LAND_110M, nightBands } from '@/lib/geo'
import { useMissionStore, type GlobeLayer } from '@/store/mission'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Form'
import { fmt } from '@/lib/format'
import { cn } from '@/utils/cn'

const SPEEDS = [
  { value: '60', label: '60×' },
  { value: '300', label: '300×' },
  { value: '1200', label: '1200×' },
  { value: '3600', label: '1h/s' },
] as const

const VIEWS = [
  // Space-fixed (inertial): the orbit stays put and Earth turns underneath it
  { value: 'space', label: 'Space' },
  { value: 'follow', label: 'Follow' },
  { value: 'site', label: 'Site' },
  { value: 'free', label: 'Free' },
] as const

const LAYERS: ReadonlyArray<{ id: GlobeLayer; label: string }> = [
  { id: 'ring', label: '3D orbit' },
  { id: 'ascent', label: 'Ascent' },
  { id: 'footprint', label: 'Coverage' },
  { id: 'terminator', label: 'Day / night' },
  { id: 'graticule', label: 'Grid' },
  { id: 'labels', label: 'Labels' },
]

type View = (typeof VIEWS)[number]['value']
const D = Math.PI / 180
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface Camera {
  lon: number
  lat: number
  zoom: number
}

interface HitTarget {
  x: number
  y: number
  r: number
  id: 'mission' | 'site'
  label: string
}

/** Orthographic projection of a point at radius ρ (Earth radii); `hidden` when behind the Earth */
function project3d(cam: Camera, lat: number, lon: number, rho: number, scale: number, cx: number, cy: number) {
  const phi = lat * D
  const dl = (lon - cam.lon) * D
  const p0 = cam.lat * D
  const X = Math.cos(phi) * Math.sin(dl)
  const Y = Math.cos(p0) * Math.sin(phi) - Math.sin(p0) * Math.cos(phi) * Math.cos(dl)
  const Z = Math.sin(p0) * Math.sin(phi) + Math.cos(p0) * Math.cos(phi) * Math.cos(dl)
  const hidden = Z < 0 && rho * rho * (X * X + Y * Y) < 1
  return { x: cx + scale * rho * X, y: cy - scale * rho * Y, hidden, front: Z >= 0 }
}

type V3 = [number, number, number]
const unit = (v: V3): V3 => {
  const m = Math.hypot(v[0], v[1], v[2])
  return [v[0] / m, v[1] / m, v[2] / m]
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** How far the Space-view camera sits from the orbit plane's pole (deg). 0 = face-on circle, 90 = edge-on line. */
const SPACE_VIEW_TILT = 40

/**
 * Initial Space-view camera direction (right ascension / declination, deg).
 * The orbit passes through the launch site, so aiming at the site looks along the plane and flattens
 * the ring to a line. Instead, look from SPACE_VIEW_TILT° off the plane's pole, tilted toward the
 * insertion point so it stays on screen.
 */
function spaceViewFor(orbit: OrbitalElements, at: Date): { ra: number; dec: number } {
  const a = propagate(orbit, at).eci
  const b = propagate(orbit, new Date(at.getTime() + 60_000)).eci
  const p: V3 = [a.x, a.y, a.z]
  const s = unit(p) // toward the insertion point
  const n = unit(cross(p, [b.x, b.y, b.z])) // orbit-plane pole
  const t = SPACE_VIEW_TILT * D
  const aim = (sign: number) => unit([0, 1, 2].map((k) => sign * Math.cos(t) * n[k]! + Math.sin(t) * s[k]!) as V3)
  const up = aim(1)
  const down = aim(-1)
  const c = up[2] >= down[2] ? up : down // prefer a northern-hemisphere view
  return { ra: Math.atan2(c[1], c[0]) / D, dec: Math.max(-85, Math.min(85, Math.asin(c[2]) / D)) }
}

interface OrbitGlobeProps {
  site: LaunchSite
  window: LaunchWindow
  name?: string
  color?: string
}

/**
 * Interactive orthographic globe: drag to rotate, wheel / buttons to zoom,
 * click satellites or the site to inspect them. Shows the single mission orbit
 * as a 3D ellipse around the Earth, with the satellite flying it continuously.
 */
export default function OrbitGlobe({ site, window: w, name = 'Mission', color = '#a78bfa' }: OrbitGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const settings = useMissionStore((s) => s.globe)
  const setGlobe = useMissionStore((s) => s.setGlobe)
  const toggleLayer = useMissionStore((s) => s.toggleLayer)
  const inspect = useMissionStore((s) => s.inspect)
  const { layers } = settings
  const speed = String(settings.speed) as (typeof SPEEDS)[number]['value']

  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [view, setView] = useState<View>('space')
  const [elapsed, setElapsed] = useState(0)
  const [showLayers, setShowLayers] = useState(false)
  const [hover, setHover] = useState<HitTarget | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const elapsedRef = useRef(0)
  const camRef = useRef<Camera>({ lon: site.longitude, lat: site.latitude * 0.6, zoom: 1 })
  /** Space view: camera direction fixed in inertial space (right ascension / declination, deg) */
  const spaceRef = useRef({ ra: site.longitude + gmst(w.insertion.time), dec: site.latitude * 0.6 })
  const hitsRef = useRef<HitTarget[]>([])
  const dragRef = useRef<{ x: number; y: number; moved: number } | null>(null)

  const orbit = w.orbit
  const periodSec = anomalisticPeriod(orbit)
  const apogeeRho = (orbit.semiMajorAxis * (1 + orbit.eccentricity)) / EARTH_RADIUS_KM

  useEffect(() => {
    elapsedRef.current = 0
    setElapsed(0)
  }, [w.id])

  // Space view starts oblique to the orbit plane (see spaceViewFor)
  useEffect(() => {
    spaceRef.current = spaceViewFor(orbit, w.insertion.time)
  }, [w.id, w.insertion.time, orbit])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const width = container.clientWidth
    const height = container.clientHeight
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1)
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const simTime = new Date(w.insertion.time.getTime() + elapsedRef.current * 1000)
    const sat = propagate(orbit, simTime)
    const cam = camRef.current
    if (view === 'space') {
      // Fixed inertial direction → Earth-fixed longitude drifts west as Earth rotates
      cam.lon = ((spaceRef.current.ra - gmst(simTime)) % 360 + 540) % 360 - 180
      cam.lat = spaceRef.current.dec
    } else if (view === 'follow') {
      cam.lon = sat.longitude
      cam.lat = sat.latitude * 0.6
    } else if (view === 'site') {
      cam.lon = site.longitude
      cam.lat = site.latitude * 0.6
    }

    const cx = width / 2
    const cy = height / 2
    // Leave room for the 3D orbit (capped so high orbits do not shrink the Earth to a dot)
    const fit = layers.ring ? Math.min(apogeeRho * 1.06, 3.2) : 1
    const scale = ((Math.min(width, height) / 2 - 10) / fit) * cam.zoom
    const P = (lat: number, lon: number, rho: number) => project3d(cam, lat, lon, rho, scale, cx, cy)

    const projection = geoOrthographic().translate([cx, cy]).scale(scale).rotate([-cam.lon, -cam.lat]).clipAngle(90)
    const path = geoPath(projection, ctx)
    const stroke = (obj: GeoPermissibleObjects, c: string, width_: number, dash: number[] = []) => {
      ctx.beginPath()
      path(obj)
      ctx.setLineDash(dash)
      ctx.strokeStyle = c
      ctx.lineWidth = width_
      ctx.stroke()
      ctx.setLineDash([])
    }
    const fill = (obj: GeoPermissibleObjects, c: string | CanvasGradient) => {
      ctx.beginPath()
      path(obj)
      ctx.fillStyle = c
      ctx.fill()
    }

    // 3D polyline split into back (behind the Earth) and front passes
    const polyline3d = (pts: Array<{ lat: number; lon: number; rho: number }>, front: boolean, c: string, lw: number, dash: number[] = []) => {
      ctx.beginPath()
      let pen = false
      for (const p of pts) {
        const q = P(p.lat, p.lon, p.rho)
        if (q.hidden !== front) {
          if (pen) ctx.lineTo(q.x, q.y)
          else ctx.moveTo(q.x, q.y)
          pen = true
        } else pen = false
      }
      ctx.setLineDash(dash)
      ctx.strokeStyle = c
      ctx.lineWidth = lw
      ctx.stroke()
      ctx.setLineDash([])
    }

    const ring = layers.ring
      ? orbitRing(orbit, simTime, 240).map((p) => ({ lat: p.latitude, lon: p.longitude, rho: p.radius / EARTH_RADIUS_KM }))
      : []

    // Far side of the orbit first, so the Earth occludes it
    if (layers.ring) polyline3d(ring, false, `${color}40`, 1.2, [3, 4])

    // Atmosphere glow
    const glow = ctx.createRadialGradient(cx, cy, scale * 0.92, cx, cy, scale * 1.08)
    glow.addColorStop(0, 'rgba(56,189,248,0.28)')
    glow.addColorStop(1, 'rgba(56,189,248,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, scale * 1.08, 0, Math.PI * 2)
    ctx.fill()

    const ocean = ctx.createRadialGradient(cx - scale * 0.35, cy - scale * 0.35, scale * 0.1, cx, cy, scale)
    ocean.addColorStop(0, '#12305a')
    ocean.addColorStop(1, '#060f22')
    fill({ type: 'Sphere' }, ocean)
    if (layers.graticule) stroke(geoGraticule10(), 'rgba(148,163,184,0.12)', 0.6)
    fill(LAND_110M, '#1c3354')
    stroke(LAND_110M, 'rgba(125,160,210,0.35)', 0.5)
    if (layers.terminator) for (const band of nightBands(simTime)) fill(band, 'rgba(0,3,10,0.3)')

    if (layers.footprint) {
      const deg = (visibilityRadius(sat.altitude, 10) / 6371) * (180 / Math.PI)
      fill(geoCircle().center([sat.longitude, sat.latitude]).radius(deg)(), 'rgba(56,189,248,0.12)')
      stroke(geoCircle().center([sat.longitude, sat.latitude]).radius(deg)(), 'rgba(56,189,248,0.4)', 0.8)
    }

    stroke({ type: 'Sphere' }, 'rgba(148,163,184,0.35)', 1)

    // Near side of the orbit + ascent climbing in 3D
    if (layers.ring) {
      polyline3d(ring, true, `${color}33`, 6)
      polyline3d(ring, true, color, 1.6)
    }
    if (layers.ascent) {
      const pts = w.trajectory.map((p) => ({ lat: p.latitude, lon: p.longitude, rho: 1 + p.altitude / EARTH_RADIUS_KM }))
      polyline3d(pts, true, '#38bdf8', 2.5)
    }

    const hits: HitTarget[] = []
    const label = (text: string, x: number, y: number, c = '#e2e8f0') => {
      if (!layers.labels) return
      ctx.font = '600 11px ui-sans-serif, system-ui'
      ctx.fillStyle = 'rgba(2,6,23,0.75)'
      const m = ctx.measureText(text).width
      ctx.fillRect(x + 7, y - 15, m + 8, 16)
      ctx.fillStyle = c
      ctx.fillText(text, x + 11, y - 3)
    }
    const dot = (x: number, y: number, r: number, c: string, halo = false) => {
      if (halo) {
        ctx.beginPath()
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2)
        ctx.fillStyle = `${c}33`
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
      ctx.lineWidth = 1.2
      ctx.strokeStyle = '#020617'
      ctx.stroke()
    }

    // Apsides on the ring
    if (layers.ring && layers.labels && orbit.eccentricity > 0.002) {
      const ringRaw = orbitRing(orbit, simTime, 2)
      const per = ringRaw[0]!
      const apo = ringRaw[1]!
      const pp = P(per.latitude, per.longitude, per.radius / EARTH_RADIUS_KM)
      const pa = P(apo.latitude, apo.longitude, apo.radius / EARTH_RADIUS_KM)
      if (!pp.hidden) {
        dot(pp.x, pp.y, 3, '#22c55e')
        label('Perigee', pp.x, pp.y, '#86efac')
      }
      if (!pa.hidden) {
        dot(pa.x, pa.y, 3, '#f59e0b')
        label('Apogee', pa.x, pa.y, '#fcd34d')
      }
    }

    // Site
    const ps = P(site.latitude, site.longitude, 1)
    if (ps.front) {
      dot(ps.x, ps.y, 5, '#22c55e', true)
      label(site.name, ps.x, ps.y)
      hits.push({ x: ps.x, y: ps.y, r: 12, id: 'site', label: `${site.name} — click for details` })
    }

    // Mission satellite: sub-point, tether and the spacecraft at altitude
    const sub = P(sat.latitude, sat.longitude, 1)
    const up = layers.ring ? P(sat.latitude, sat.longitude, sat.radius / EARTH_RADIUS_KM) : sub
    if (layers.ring && !up.hidden && sub.front) {
      ctx.beginPath()
      ctx.moveTo(sub.x, sub.y)
      ctx.lineTo(up.x, up.y)
      ctx.strokeStyle = 'rgba(248,250,252,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
      dot(sub.x, sub.y, 2, 'rgba(248,250,252,0.8)')
    }
    if (!up.hidden) {
      dot(up.x, up.y, 6, '#f8fafc', true)
      label(name, up.x, up.y, '#ede9fe')
      hits.push({ x: up.x, y: up.y, r: 14, id: 'mission', label: `${name} — click to inspect TLE` })
    }

    hitsRef.current = hits
  }, [w, orbit, view, layers, apogeeRho, site, name, color])

  // Animation clock: runs continuously, no looping
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      elapsedRef.current += dt * Number(speed)
      if (now - lastUi > 100) {
        setElapsed(elapsedRef.current)
        lastUi = now
      }
      draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, draw])

  // Redraw when paused or resized
  useEffect(() => {
    draw()
    const ro = new ResizeObserver(() => draw())
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [draw])

  // Wheel zoom needs a non-passive listener to prevent page scroll
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw])

  useEffect(() => {
    const onFs = () => {
      setFullscreen(document.fullscreenElement === frameRef.current)
      requestAnimationFrame(() => draw())
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [draw])

  function zoomBy(f: number) {
    camRef.current.zoom = Math.min(8, Math.max(0.2, camRef.current.zoom * f))
    draw()
  }
  function rotateBy(dLon: number, dLat: number) {
    if (view === 'space') {
      // Dragging in space view turns the camera, not the Earth
      const sp = spaceRef.current
      sp.ra += dLon
      sp.dec = Math.max(-89, Math.min(89, sp.dec + dLat))
      draw()
      return
    }
    setView('free')
    const cam = camRef.current
    cam.lon = ((cam.lon + dLon + 540) % 360) - 180
    cam.lat = Math.max(-89, Math.min(89, cam.lat + dLat))
    draw()
  }
  const hitAt = (x: number, y: number) =>
    hitsRef.current.reduce<HitTarget | null>((best, h) => {
      const d = Math.hypot(h.x - x, h.y - y)
      return d <= h.r && (!best || d < Math.hypot(best.x - x, best.y - y)) ? h : best
    }, null)

  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const sat = propagate(orbit, new Date(w.insertion.time.getTime() + elapsed * 1000))
  const revNo = Math.floor(elapsed / periodSec) + 1

  return (
    <div className="space-y-4">
      <div ref={frameRef} className={cn('relative overflow-hidden rounded-xl border border-white/5 bg-[radial-gradient(ellipse_at_center,#0b1730_0%,#030712_70%)]', fullscreen && 'rounded-none')}>
        <div className="starfield pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div ref={containerRef} className={cn('relative w-full', fullscreen ? 'h-screen' : 'aspect-square max-h-[640px] sm:aspect-[4/3]')}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            className={cn('h-full w-full touch-none outline-none', hover ? 'cursor-pointer' : dragRef.current ? 'cursor-grabbing' : 'cursor-grab')}
            role="img"
            aria-label={`Interactive globe: ${name} orbit at ${Math.round(sat.altitude)} km altitude, simulated continuously from ${site.name}. Drag or use arrow keys to rotate, plus and minus to zoom.`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              dragRef.current = { ...local(e), moved: 0 }
            }}
            onPointerMove={(e) => {
              const p = local(e)
              const drag = dragRef.current
              if (drag) {
                const dx = p.x - drag.x
                const dy = p.y - drag.y
                drag.moved += Math.abs(dx) + Math.abs(dy)
                if (drag.moved > 4) {
                  const container = containerRef.current!
                  const degPerPx = 180 / (Math.PI * (Math.min(container.clientWidth, container.clientHeight) / 2) * camRef.current.zoom)
                  rotateBy(-dx * degPerPx, dy * degPerPx)
                }
                drag.x = p.x
                drag.y = p.y
              } else {
                setHover(hitAt(p.x, p.y))
              }
            }}
            onPointerUp={(e) => {
              const drag = dragRef.current
              dragRef.current = null
              if (drag && drag.moved <= 4) {
                const h = hitAt(local(e).x, local(e).y)
                if (h) inspect(h.id)
              }
            }}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              const k: Record<string, () => void> = {
                ArrowLeft: () => rotateBy(-8, 0),
                ArrowRight: () => rotateBy(8, 0),
                ArrowUp: () => rotateBy(0, 8),
                ArrowDown: () => rotateBy(0, -8),
                '+': () => zoomBy(1.25),
                '=': () => zoomBy(1.25),
                '-': () => zoomBy(0.8),
                ' ': () => setPlaying((p) => !p),
              }
              const fn = k[e.key]
              if (fn) {
                e.preventDefault()
                fn()
              }
            }}
          />
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-slate-950/90 px-2 py-1 text-[11px] shadow-lg animate-in fade-in-0 zoom-in-95"
              style={{ left: hover.x, top: hover.y - 12 }}
            >
              {hover.label}
            </div>
          )}
        </div>

        {/* Overlay controls */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="glass-chip" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            <span className="hidden sm:inline">{playing ? 'Pause' : 'Play'}</span>
          </Button>
          <Segmented label="Simulation speed" value={speed} options={SPEEDS} onChange={(v) => setGlobe({ speed: Number(v) })} className="glass-chip w-52 rounded-lg" />
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          <Segmented label="Camera" value={view} options={VIEWS} onChange={setView} className="glass-chip w-56 rounded-lg" />
          <div className="relative">
            <Button variant="secondary" size="sm" className="glass-chip" onClick={() => setShowLayers((s) => !s)} aria-expanded={showLayers} aria-controls="globe-layers">
              <Layers aria-hidden /> Layers
            </Button>
            {showLayers && (
              <div id="globe-layers" className="glass-panel absolute right-0 top-10 z-20 w-52 space-y-1 rounded-xl p-2 animate-in fade-in-0 slide-in-from-top-2">
                {LAYERS.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-white/5">
                    {l.label}
                    <input type="checkbox" className="size-3.5 accent-[hsl(var(--primary))]" checked={layers[l.id]} onChange={() => toggleLayer(l.id)} />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1">
          {[
            { icon: <Plus aria-hidden />, label: 'Zoom in', fn: () => zoomBy(1.25) },
            { icon: <Minus aria-hidden />, label: 'Zoom out', fn: () => zoomBy(0.8) },
            {
              icon: <RotateCcw aria-hidden />,
              label: 'Reset view',
              fn: () => {
                camRef.current.zoom = 1
                spaceRef.current = spaceViewFor(orbit, w.insertion.time)
                setView('space')
                draw()
              },
            },
            { icon: <Crosshair aria-hidden />, label: 'Centre on site', fn: () => setView('site') },
            {
              icon: fullscreen ? <Shrink aria-hidden /> : <Expand aria-hidden />,
              label: fullscreen ? 'Exit full screen' : 'Full screen',
              fn: () => void (fullscreen ? document.exitFullscreen() : frameRef.current?.requestFullscreen())?.catch(() => undefined),
            },
          ].map((b) => (
            <Button key={b.label} variant="secondary" size="icon" className="glass-chip size-8" onClick={b.fn} aria-label={b.label} title={b.label}>
              {b.icon}
            </Button>
          ))}
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[10px] text-slate-400/80 sm:block">{view === 'space' ? 'Space view: the orbit is fixed — Earth turns under it · ' : ''}Drag to rotate · scroll to zoom · click the satellite or the site</p>
      </div>

      <dl className="tabular grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Since insertion', fmt.duration(elapsed)],
          ['Revolution', `Rev ${revNo}`],
          ['Altitude', fmt.km(sat.altitude)],
          ['Speed', `${sat.speed.toFixed(2)} km/s`],
          ['Sub-satellite', `${fmt.lat(sat.latitude)} ${fmt.lon(sat.longitude)}`],
          ['Sim time', fmt.utcTime(sat.time)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-background/40 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className="truncate font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-go" /> Launch site</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-sky-400" /> Ascent</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4" style={{ backgroundColor: color }} /> Orbit (one ellipse, fixed in space)</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-sky-400/30" /> Coverage (10° elev.)</li>
      </ul>
    </div>
  )
}