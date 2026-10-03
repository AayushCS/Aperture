import type { LaunchOpportunity, LaunchSite } from '@aperture/orbital-core'
import { fmt } from '@/lib/format'

/** Compass rose with the range-safety corridor and the mission's flight azimuths */
export default function CorridorCompass({
  site,
  opportunities = [],
  size = 160,
}: {
  site: LaunchSite
  opportunities?: readonly LaunchOpportunity[]
  size?: number
}) {
  const c = size / 2
  const r = size / 2 - 16
  const pt = (az: number, rad: number) => {
    const t = ((az - 90) * Math.PI) / 180
    return [c + rad * Math.cos(t), c + rad * Math.sin(t)] as const
  }
  const wedge = (from: number, to: number) => {
    const span = (((to - from) % 360) + 360) % 360
    const [x1, y1] = pt(from, r)
    const [x2, y2] = pt(to, r)
    return `M${c},${c} L${x1},${y1} A${r},${r} 0 ${span > 180 ? 1 : 0} 1 ${x2},${y2} Z`
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Range-safety corridor ${(site.azimuthCorridors ?? []).map(([a, b]) => `${a}° to ${b}°`).join(', ')}. ${opportunities
        .map((o) => `${o.branch} pass ${o.azimuth.toFixed(1)}° ${o.withinCorridor ? 'allowed' : 'restricted'}`)
        .join('; ')}.`}
    >
      <circle cx={c} cy={c} r={r} fill="rgba(8,15,30,0.6)" stroke="rgba(148,163,184,0.25)" />
      {[0.33, 0.66].map((f) => (
        <circle key={f} cx={c} cy={c} r={r * f} fill="none" stroke="rgba(148,163,184,0.08)" />
      ))}
      {(site.azimuthCorridors ?? []).map(([from, to]) => (
        <path key={`${from}-${to}`} d={wedge(from, to)} fill="rgba(34,197,94,0.14)" stroke="rgba(34,197,94,0.5)" />
      ))}
      {['N', 'E', 'S', 'W'].map((l, i) => {
        const [x, y] = pt(i * 90, r + 9)
        return (
          <text key={l} x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fill="rgba(203,213,225,0.7)">
            {l}
          </text>
        )
      })}
      {opportunities.map((o) => {
        const [x, y] = pt(o.azimuth, r - 6)
        const col = o.withinCorridor ? '#38bdf8' : '#ef4444'
        return (
          <g key={o.branch}>
            <line x1={c} y1={c} x2={x} y2={y} stroke={col} strokeWidth={2} strokeDasharray={o.withinCorridor ? undefined : '3 3'} />
            <circle cx={x} cy={y} r={3.5} fill={col} />
            <title>{`${o.branch} pass ${fmt.deg(o.azimuth)}${o.withinCorridor ? '' : ' (restricted)'}`}</title>
          </g>
        )
      })}
      <circle cx={c} cy={c} r={3} fill="#22c55e" />
    </svg>
  )
}