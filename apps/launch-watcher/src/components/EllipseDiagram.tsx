import { useEffect, useRef, useState } from 'react'
import { EARTH_RADIUS_KM, meanToTrueAnomaly, radiusAt, type OrbitalElements } from '@aperture/orbital-core'
import { fmt } from '@/lib/format'

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The orbit drawn in its own plane, Earth at one focus, to scale.
 * A satellite marker moves with Kepler timing — visibly faster at perigee.
 * `exaggerate` stretches the eccentricity of nearly circular orbits so the shape is readable.
 */
export default function EllipseDiagram({
  orbit,
  exaggerate = 1,
  color = '#a78bfa',
  size = 280,
  insertionTrueAnomaly,
  labels = true,
}: {
  orbit: OrbitalElements
  exaggerate?: number
  color?: string
  size?: number
  insertionTrueAnomaly?: number
  labels?: boolean
}) {
  const e = orbit.eccentricity
  const a = orbit.semiMajorAxis
  const shape = { semiMajorAxis: a, eccentricity: e }
  const rp = a * (1 - e)
  const ra = a * (1 + e)
  const half = size / 2

  /*
   * True shape: radii to scale. Exaggerated: the Earth is drawn smaller and
   * altitudes are stretched linearly, so a nearly circular orbit shows its
   * perigee / apogee difference without ever dipping inside the Earth.
   */
  const trueScale = (size * 0.86) / (rp + ra)
  const earthDisp = exaggerate > 1 ? size * 0.2 : EARTH_RADIUS_KM * trueScale
  const altK = exaggerate > 1 ? (size * 0.4 - earthDisp) / Math.max(1, ra - EARTH_RADIUS_KM) : trueScale
  const radial = (r: number) => (exaggerate > 1 ? earthDisp + (r - EARTH_RADIUS_KM) * altK : r * trueScale)
  const ox = half + (radial(ra) - radial(rp)) / 2 // Earth (focus) position
  const oy = half
  const toXY = (nu: number) => {
    const r = radial(radiusAt(shape, nu))
    const t = (nu * Math.PI) / 180
    return [ox + r * Math.cos(t), oy - r * Math.sin(t)] as const
  }
  const orbitPath =
    Array.from({ length: 181 }, (_, k) => {
      const [x, y] = toXY(k * 2)
      return `${k ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
    }).join('') + 'Z'

  const [m, setM] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (reducedMotion()) return
    let last = performance.now()
    const tick = (now: number) => {
      // One revolution every 8 s
      setM((prev) => (prev + ((now - last) / 8000) * 360) % 360)
      last = now
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const nu = meanToTrueAnomaly(m, e)
  const [sx, sy] = toXY(nu)
  const earthR = Math.max(3, earthDisp)
  const [px, py] = toXY(0)
  const [ax, ay] = toXY(180)
  const ins = insertionTrueAnomaly !== undefined ? toXY(insertionTrueAnomaly) : null

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Orbit shape: perigee ${fmt.km(perigeeAlt(orbit))}, apogee ${fmt.km(apogeeAlt(orbit))}, eccentricity ${orbit.eccentricity.toFixed(4)}${exaggerate > 1 ? `, shape exaggerated ${exaggerate}×` : ''}.`}
    >
      <defs>
        <radialGradient id="ed-earth" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#0b1d3a" />
        </radialGradient>
        <filter id="ed-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {/* Apsidal line */}
      <line x1={ax} y1={ay} x2={px} y2={py} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 4" />
      <path d={orbitPath} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={6} filter="url(#ed-glow)" />
      <path d={orbitPath} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={ox} cy={oy} r={earthR} fill="url(#ed-earth)" stroke="rgba(56,189,248,0.5)" />
      <circle cx={px} cy={py} r={3} fill="#22c55e" />
      <circle cx={ax} cy={ay} r={3} fill="#f59e0b" />
      {labels && (
        <>
          <text x={px - 4} y={oy - radial(rp) - 10} textAnchor="end" fontSize={10} fill="#86efac">
            Perigee {Math.round(perigeeAlt(orbit))} km →
          </text>
          <text x={ax + 4} y={oy + radial(ra) + 16} textAnchor="start" fontSize={10} fill="#fcd34d">
            ← Apogee {Math.round(apogeeAlt(orbit))} km
          </text>
        </>
      )}
      {ins && (
        <g transform={`translate(${ins[0]},${ins[1]}) rotate(45)`}>
          <rect x={-3.5} y={-3.5} width={7} height={7} fill="#38bdf8" stroke="#020617" />
        </g>
      )}
      <circle cx={sx} cy={sy} r={8} fill={color} opacity={0.25} />
      <circle cx={sx} cy={sy} r={3.5} fill="#f8fafc" />
      {exaggerate > 1 && (
        <text x={size - 6} y={size - 6} textAnchor="end" fontSize={9} fill="rgba(148,163,184,0.7)">
          altitude exaggerated
        </text>
      )}
    </svg>
  )
}

const perigeeAlt = (o: OrbitalElements) => o.semiMajorAxis * (1 - o.eccentricity) - EARTH_RADIUS_KM
const apogeeAlt = (o: OrbitalElements) => o.semiMajorAxis * (1 + o.eccentricity) - EARTH_RADIUS_KM