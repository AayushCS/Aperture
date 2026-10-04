import { Moon, Sun, Sunrise, Sparkles } from 'lucide-react'
import type { ConjunctionScreen, LaunchWindow } from '@aperture/orbital-core'
import type { ScreeningState } from '@/store/screening'
import { RiskBadge } from '@/components/ui/Badge'
import { fmt } from '@/lib/format'
import { SITE } from '@/hooks/useMissionPlan'
import { cn } from '@/utils/cn'

export function LightingLabel({ window }: { window: LaunchWindow }) {
  const { condition, plumeSunlit } = window.lighting
  const Icon = plumeSunlit ? Sparkles : condition === 'day' ? Sun : condition === 'twilight' ? Sunrise : Moon
  const label = plumeSunlit ? 'Sunlit plume' : condition === 'day' ? 'Daylight' : condition === 'twilight' ? 'Twilight' : 'Night'
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={`Sun ${fmt.deg(window.lighting.sunElevation)} at pad`}>
      <Icon aria-hidden className={cn('size-3.5', plumeSunlit && 'text-violet-300')} />
      {label}
    </span>
  )
}

export function ScoreBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="tabular w-8 text-right text-xs font-medium">{Math.round(value * 100)}</span>
    </span>
  )
}

/** Post-insertion conjunction screen result for one window */
export function ScreenLabel({ screen, status }: { screen?: ConjunctionScreen; status: ScreeningState['status'] }) {
  if (screen?.blocked) {
    return (
      <span className="block" title={`${screen.reason} — at nominal liftoff`}>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30">Close pass</span>
        <span className="tabular mt-0.5 block max-w-[11rem] truncate text-[11px] text-muted-foreground">
          {screen.closest!.distanceKm.toFixed(1)} km · {screen.closest!.name}
        </span>
      </span>
    )
  }
  if (screen) {
    return (
      <span className="block" title={screen.closest ? `Closest approach ${screen.closest.distanceKm.toFixed(1)} km from ${screen.closest.name}` : undefined}>
        <span className="text-xs font-semibold text-go">Clear</span>
        {screen.closest && <span className="tabular block text-[11px] text-muted-foreground">≥ {screen.closest.distanceKm.toFixed(0)} km</span>}
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{status === 'running' ? 'Screening…' : '—'}</span>
}

interface WindowTableProps {
  windows: readonly LaunchWindow[]
  selectedId?: string
  onSelect?: (id: string) => void
  limit?: number
  caption: string
  screening?: ScreeningState
}

export default function WindowTable({ windows, selectedId, onSelect, limit, caption, screening }: WindowTableProps) {
  const rows = limit ? windows.slice(0, limit) : windows
  const best = windows.reduce<LaunchWindow | undefined>((b, w) => (!b || w.quality > b.quality ? w : b), undefined)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-2 pl-5 pr-3 font-medium">Liftoff (T-0)</th>
            <th scope="col" className="px-3 py-2 font-medium">Window</th>
            <th scope="col" className="px-3 py-2 font-medium">Azimuth</th>
            <th scope="col" className="px-3 py-2 font-medium">Lighting</th>
            <th scope="col" className="px-3 py-2 font-medium">Weather</th>
            {screening && <th scope="col" className="px-3 py-2 font-medium">Conjunction</th>}
            <th scope="col" className="py-2 pl-3 pr-5 font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => {
            const selected = w.id === selectedId
            return (
              <tr
                key={w.id}
                aria-selected={onSelect ? selected : undefined}
                className={cn(
                  'border-b border-border/60 transition-colors last:border-0',
                  onSelect && 'cursor-pointer hover:bg-accent/40',
                  selected && 'bg-primary/10 hover:bg-primary/15'
                )}
                onClick={onSelect ? () => onSelect(w.id) : undefined}
              >
                <td className="py-2.5 pl-5 pr-3">
                  {onSelect ? (
                    <button
                      type="button"
                      className="text-left focus-visible:rounded-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(w.id)
                      }}
                      aria-pressed={selected}
                    >
                      <WindowTime w={w} isBest={w.id === best?.id} />
                    </button>
                  ) : (
                    <WindowTime w={w} isBest={w.id === best?.id} />
                  )}
                </td>
                <td className="tabular px-3 py-2.5 text-muted-foreground">{fmt.duration(w.duration)}</td>
                <td className="tabular px-3 py-2.5">
                  {fmt.deg(w.azimuth)}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">{w.branch === 'ascending' ? 'Asc' : 'Desc'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <LightingLabel window={w} />
                </td>
                <td className="px-3 py-2.5">
                  <RiskBadge risk={w.weatherRisk} />
                </td>
                {screening && (
                  <td className="px-3 py-2.5">
                    <ScreenLabel screen={screening.results[w.id]} status={screening.status} />
                  </td>
                )}
                <td className="py-2.5 pl-3 pr-5">
                  <ScoreBar value={w.quality} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WindowTime({ w, isBest }: { w: LaunchWindow; isBest: boolean }) {
  return (
    <span className="block">
      <span className="tabular flex items-center gap-2 font-medium">
        {fmt.utcDateTime(w.optimal)}
        {isBest && (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Best
          </span>
        )}
      </span>
      <span className="tabular block text-[11px] text-muted-foreground" title={`Your time: ${fmt.local(w.optimal)}`}>
        Liftoff {fmt.zonedTime(w.optimal, SITE.timeZone!)} → orbit {fmt.zonedTime(w.insertion.time, SITE.timeZone!)}{' '}
        {fmt.zoneName(w.optimal, SITE.timeZone!)}
      </span>
    </span>
  )
}
