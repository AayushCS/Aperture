import { useState } from 'react'
import { cn } from '@/utils/cn'

interface Field {
  from: number
  to: number
  label: string
  color: string
  explain: string
}

const LINE1: Field[] = [
  { from: 2, to: 7, label: 'Catalog number', color: 'text-sky-300', explain: 'NORAD satellite catalog number.' },
  { from: 7, to: 8, label: 'Classification', color: 'text-slate-400', explain: 'U = unclassified.' },
  { from: 9, to: 17, label: 'International designator', color: 'text-slate-300', explain: 'Launch year, launch number of the year, piece.' },
  { from: 18, to: 32, label: 'Epoch', color: 'text-amber-300', explain: 'Year and fractional day of year (UTC) at which the elements are valid.' },
  { from: 33, to: 43, label: 'ṅ / 2', color: 'text-rose-300', explain: 'First derivative of mean motion ÷ 2 (rev/day²) — orbital decay.' },
  { from: 44, to: 52, label: 'n̈ / 6', color: 'text-rose-200', explain: 'Second derivative of mean motion ÷ 6 (rev/day³).' },
  { from: 53, to: 61, label: 'B*', color: 'text-orange-300', explain: 'SGP4 drag term (1/Earth radii).' },
  { from: 62, to: 63, label: 'Ephemeris type', color: 'text-slate-400', explain: 'Always 0 in distributed TLEs.' },
  { from: 64, to: 68, label: 'Element set number', color: 'text-slate-300', explain: 'Incremented each time a new set is generated.' },
  { from: 68, to: 69, label: 'Checksum', color: 'text-emerald-300', explain: 'Sum of digits (minus signs count 1) modulo 10.' },
]

const LINE2: Field[] = [
  { from: 2, to: 7, label: 'Catalog number', color: 'text-sky-300', explain: 'Must match line 1.' },
  { from: 8, to: 16, label: 'Inclination', color: 'text-violet-300', explain: 'Tilt of the orbital plane from the equator (deg).' },
  { from: 17, to: 25, label: 'RAAN', color: 'text-fuchsia-300', explain: 'Right ascension of the ascending node (deg) — where the plane is in space. Sets the launch time.' },
  { from: 26, to: 33, label: 'Eccentricity', color: 'text-cyan-300', explain: 'Decimal point assumed: 0213428 → 0.0213428. 0 = circle.' },
  { from: 34, to: 42, label: 'Argument of perigee', color: 'text-teal-300', explain: 'Angle from the ascending node to the lowest point (deg).' },
  { from: 43, to: 51, label: 'Mean anomaly', color: 'text-lime-300', explain: 'Where the satellite is along the orbit at epoch (deg, 0 = perigee).' },
  { from: 52, to: 63, label: 'Mean motion', color: 'text-amber-300', explain: 'Revolutions per day (Kozai). Sets the orbit size.' },
  { from: 63, to: 68, label: 'Revolution number', color: 'text-slate-300', explain: 'Orbits completed at epoch.' },
  { from: 68, to: 69, label: 'Checksum', color: 'text-emerald-300', explain: 'Sum of digits (minus signs count 1) modulo 10.' },
]

/** Colour-coded TLE with per-field explanations on hover / focus */
export default function TleView({ name, lines, className }: { name?: string; lines: readonly [string, string]; className?: string }) {
  const [active, setActive] = useState<Field | null>(null)

  const render = (line: string, fields: Field[], row: number) => {
    const parts: React.ReactNode[] = []
    let cursor = 2
    fields.forEach((f, i) => {
      if (f.from > cursor) parts.push(<span key={`g${i}`} className="text-slate-500">{line.slice(cursor, f.from)}</span>)
      parts.push(
        <span
          key={i}
          tabIndex={0}
          title={f.label}
          onMouseEnter={() => setActive(f)}
          onFocus={() => setActive(f)}
          className={cn(
            'cursor-help rounded-sm transition-colors focus:outline-none',
            f.color,
            active === f ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'
          )}
        >
          {line.slice(f.from, f.to)}
        </span>
      )
      cursor = f.to
    })
    return (
      <div key={row} className="whitespace-pre">
        <span className="text-slate-500">{line.slice(0, 2)}</span>
        {parts}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)} onMouseLeave={() => setActive(null)}>
      <div className="overflow-x-auto rounded-lg border border-white/5 bg-black/40 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed sm:text-xs">
        {name && <div className="text-slate-300">{name}</div>}
        {render(lines[0], LINE1, 1)}
        {render(lines[1], LINE2, 2)}
      </div>
      <p className="min-h-[2.5em] text-[11px] leading-snug text-muted-foreground" aria-live="polite">
        {active ? (
          <>
            <span className={cn('font-semibold', active.color)}>{active.label}</span> — {active.explain}
          </>
        ) : (
          'Hover or tab through the fields to see what each column means.'
        )}
      </p>
    </div>
  )
}