import type { ReactNode } from 'react'
import type { WeatherRisk } from '@aperture/orbital-core'
import { RISK_META } from '@/lib/format'
import { cn } from '@/utils/cn'

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </span>
  )
}

/** Green / Yellow / Red launch-weather status. Colour is paired with text for accessibility. */
export function RiskBadge({ risk, className, size = 'sm' }: { risk: WeatherRisk; className?: string; size?: 'sm' | 'lg' }) {
  const meta = RISK_META[risk]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset',
        meta.bg,
        meta.text,
        meta.ring,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-sm',
        className
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.short}
    </span>
  )
}

export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-lg border bg-background/40 px-3 py-2.5', className)}>
      <dt className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 truncate text-base font-semibold">{value}</dd>
      {hint && <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  )
}
