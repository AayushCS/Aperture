import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { OrbitClass } from '@aperture/orbital-core'
import { CATALOG, CLASS_COLOR } from '@/data/catalog'
import { useMissionStore } from '@/store/mission'
import { summarizeOrbit } from '@/lib/orbitStats'
import { cn } from '@/utils/cn'

const FILTERS: ReadonlyArray<OrbitClass | 'ALL'> = ['ALL', 'SSO', 'GEO', 'HEO']

/** Clickable list of Canadian satellites; each opens the inspector */
export default function CatalogList({ limit, className }: { limit?: number; className?: string }) {
  const inspect = useMissionStore((s) => s.inspect)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const rows = useMemo(
    () =>
      CATALOG.filter((s) => filter === 'ALL' || s.orbitClass === filter)
        .map((s) => ({ s, sum: summarizeOrbit(s.elements) }))
        .slice(0, limit),
    [filter, limit]
  )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-1" role="group" aria-label="Filter by orbit class">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              filter === f ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            {f === 'ALL' ? 'All' : f}
          </button>
        ))}
      </div>
      <ul className="space-y-1">
        {rows.map(({ s, sum }, i) => (
          <li key={s.id} className="animate-in fade-in-0 slide-in-from-left-2" style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}>
            <button
              type="button"
              onClick={() => inspect(s.id)}
              aria-haspopup="dialog"
              className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-white/5"
            >
              <span aria-hidden className="relative flex size-2.5 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full opacity-40" style={{ backgroundColor: s.color, animationDuration: `${2 + (i % 3)}s` }} />
                <span className="relative inline-flex size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  <span className="text-[10px] font-semibold" style={{ color: CLASS_COLOR[s.orbitClass] }}>
                    {s.orbitClass}
                  </span>
                </span>
                <span className="tabular block truncate text-[11px] text-muted-foreground">
                  {s.operator} · {Math.round(sum.perigee).toLocaleString()}–{Math.round(sum.apogee).toLocaleString()} km · {s.elements.inclination.toFixed(1)}°
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}