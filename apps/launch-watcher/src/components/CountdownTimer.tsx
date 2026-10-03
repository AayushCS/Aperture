import type { LaunchWindow } from '@aperture/orbital-core'
import { useNow } from '@/hooks/useNow'
import { fmt } from '@/lib/format'
import { cn } from '@/utils/cn'

type Phase = 'pending' | 'open' | 'closed'

function phaseOf(window: LaunchWindow, now: Date): Phase {
  if (now < window.start) return 'pending'
  if (now <= window.end) return 'open'
  return 'closed'
}

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/** Live countdown to window open, then to window close */
export default function CountdownTimer({ window }: { window: LaunchWindow }) {
  const now = useNow(1000)
  const phase = phaseOf(window, now)
  const target = phase === 'pending' ? window.start : window.end
  const t = split(target.getTime() - now.getTime())
  const units = [
    { label: 'Days', value: t.days },
    { label: 'Hours', value: t.hours },
    { label: 'Minutes', value: t.minutes },
    { label: 'Seconds', value: t.seconds },
  ]
  const openProgress =
    phase === 'open' ? (now.getTime() - window.start.getTime()) / (window.end.getTime() - window.start.getTime()) : 0

  const heading =
    phase === 'pending' ? 'Window opens in' : phase === 'open' ? 'Window open · closes in' : 'Window closed'

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {phase === 'open' && <span aria-hidden className="size-2 animate-pulse rounded-full bg-go" />}
        {heading}
      </div>

      {/* Visual countdown is hidden from screen readers; a polite summary is announced each minute instead */}
      <div aria-hidden className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
        {units.map((u) => (
          <div key={u.label} className="rounded-lg border bg-background/50 px-2 py-3 text-center">
            <div className={cn('tabular font-mono text-3xl font-semibold sm:text-5xl', phase === 'open' && 'text-go')}>
              {String(u.value).padStart(2, '0')}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground sm:text-[11px]">{u.label}</div>
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {heading} {t.days} days {t.hours} hours {t.minutes} minutes
      </p>

      <div className="mt-4 space-y-1.5">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-go transition-[width] duration-1000"
            style={{ width: `${Math.min(100, openProgress * 100)}%` }}
          />
        </div>
        <div className="tabular flex justify-between text-[11px] text-muted-foreground">
          <span>Open {fmt.utcTime(window.start)}</span>
          <span className="text-foreground">T-0 {fmt.utcTime(window.optimal)}</span>
          <span>Close {fmt.utcTime(window.end)}</span>
        </div>
      </div>
    </div>
  )
}
