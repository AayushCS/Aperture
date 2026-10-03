import { useEffect, useRef } from 'react'
import { useMissionStore, ORBIT_PRESETS } from '@/store/mission'
import { designMissionOrbit } from '@/hooks/useMissionPlan'
import { EARTH_RADIUS_KM, meanToTrueAnomaly, type OrbitalElements } from '@aperture/orbital-core'

const D = Math.PI / 180
const FAMILY_COLORS = { LEO: '#38bdf8', POLAR: '#2dd4bf', SSO: '#a78bfa' } as const
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface BackdropOrbit {
  el: OrbitalElements
  color: string
  width: number
  phase: number
  mission: boolean
}

/** Map radius (Earth radii) to a display radius so LEO and GEO both read well */
const displayRho = (rho: number) => 1.22 + (1.7 * Math.log(Math.max(1, rho))) / Math.log(6.6)

/**
 * Decorative full-page backdrop: faint LEO / polar / SSO reference orbits and the mission orbit
 * (log-scaled radii) circling a dim Earth, with satellites moving at Kepler speed.
 * Purely visual — hidden from assistive technology, paused when the tab is hidden
 * and static under prefers-reduced-motion.
 */
export default function OrbitBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)
  const mission = useMissionStore((s) => s.mission)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const epoch = new Date('2027-12-01T00:00:00Z')
    const orbits: BackdropOrbit[] = [
      // Reference planes for each family, spread around the Earth, plus the mission orbit highlighted
      ...(['LEO', 'POLAR', 'SSO'] as const).flatMap((f, i) =>
        [0, 120, 240].map((raan, j) => ({
          el: designMissionOrbit({ ...mission, orbitType: f, ...ORBIT_PRESETS[f] }, epoch, raan + i * 40),
          color: FAMILY_COLORS[f],
          width: 0.8,
          phase: i * 97 + j * 53,
          mission: false,
        }))
      ),
      { el: designMissionOrbit(mission, epoch), color: '#e9d5ff', width: 1.6, phase: 0, mission: true },
    ]

    let raf = 0
    let last = 0
    const start = performance.now()
    const still = reducedMotion()

    const frame = (now: number) => {
      raf = still ? 0 : requestAnimationFrame(frame)
      if (now - last < 33) return // ~30 fps is plenty for a backdrop
      last = now
      const t = (now - start) / 1000
      const dpr = Math.min(1.5, globalThis.devicePixelRatio || 1)
      const w = globalThis.innerWidth
      const h = globalThis.innerHeight
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const R = Math.min(w, h) * 0.13
      const cx = w * 0.82
      const cy = h * 0.2
      const tilt = 68 * D
      const spin = t * 0.02

      // Earth-centred inertial → camera (spin about z, then tilt about x)
      const view = (x: number, y: number, z: number) => {
        const xs = x * Math.cos(spin) - y * Math.sin(spin)
        const ys = x * Math.sin(spin) + y * Math.cos(spin)
        const yv = ys * Math.cos(tilt) - z * Math.sin(tilt)
        const zv = ys * Math.sin(tilt) + z * Math.cos(tilt)
        return { x: cx + xs * R, y: cy + yv * R, z: zv }
      }
      const point = (el: OrbitalElements, nu: number) => {
        const r = (el.semiMajorAxis * (1 - el.eccentricity ** 2)) / (1 + el.eccentricity * Math.cos(nu * D)) / EARTH_RADIUS_KM
        const rho = displayRho(r)
        const u = (el.argOfPerigee + nu) * D
        const O = el.raan * D
        const i = el.inclination * D
        return view(
          rho * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i)),
          rho * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i)),
          rho * Math.sin(u) * Math.sin(i)
        )
      }

      const pass = (front: boolean) => {
        for (const o of orbits) {
          ctx.beginPath()
          let pen = false
          for (let k = 0; k <= 120; k++) {
            const p = point(o.el, k * 3)
            if (p.z >= 0 === front) {
              if (pen) ctx.lineTo(p.x, p.y)
              else ctx.moveTo(p.x, p.y)
              pen = true
            } else pen = false
          }
          ctx.strokeStyle = o.color
          ctx.globalAlpha = (front ? 0.35 : 0.12) * (o.mission ? 1.6 : 1)
          ctx.lineWidth = o.width
          ctx.stroke()

          // Satellite: mean anomaly advances with a compressed Kepler rate (outer orbits slower)
          const aRho = displayRho(o.el.semiMajorAxis / EARTH_RADIUS_KM)
          const M = (o.phase + t * (40 / aRho ** 1.5) * (o.mission ? 1.3 : 1)) % 360
          const s = point(o.el, meanToTrueAnomaly(M, o.el.eccentricity))
          if (s.z >= 0 === front) {
            ctx.globalAlpha = front ? 0.9 : 0.35
            ctx.fillStyle = o.color
            ctx.beginPath()
            ctx.arc(s.x, s.y, o.mission ? 2.8 : 1.8, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalAlpha = front ? 0.25 : 0.1
            ctx.beginPath()
            ctx.arc(s.x, s.y, o.mission ? 9 : 5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1
      }

      pass(false)
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R)
      g.addColorStop(0, 'rgba(37,99,235,0.55)')
      g.addColorStop(1, 'rgba(3,10,25,0.95)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(56,189,248,0.35)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      pass(true)
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', onVisibility)
    const onResize = () => still && requestAnimationFrame(frame)
    globalThis.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      globalThis.removeEventListener('resize', onResize)
    }
  }, [mission])

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70" />
}