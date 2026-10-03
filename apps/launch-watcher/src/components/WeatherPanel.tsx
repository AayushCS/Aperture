import { CloudLightning, CloudRain, Cloud, Wind, Gauge } from 'lucide-react'
import type { WeatherAssessment, WeatherFactor } from '@aperture/orbital-core'
import { RiskBadge } from '@/components/ui/Badge'
import { RISK_META, fmt } from '@/lib/format'
import { cn } from '@/utils/cn'

const FACTOR_ICON: Record<string, typeof Wind> = {
  'Surface wind': Wind,
  'Wind gusts': Gauge,
  'Lightning potential': CloudLightning,
  Precipitation: CloudRain,
  'Cloud cover': Cloud,
}

const STATUS_STYLE: Record<WeatherFactor['status'], { label: string; text: string; bar: string }> = {
  go: { label: 'Go', text: 'text-go', bar: 'bg-go' },
  watch: { label: 'Watch', text: 'text-watch', bar: 'bg-watch' },
  nogo: { label: 'No-go', text: 'text-nogo', bar: 'bg-nogo' },
}

/** Green / Yellow / Red weather indicator with the launch-commit criteria behind it */
export default function WeatherPanel({ weather, compact = false }: { weather: WeatherAssessment; compact?: boolean }) {
  const meta = RISK_META[weather.risk]
  return (
    <div className="space-y-4">
      <div className={cn('flex items-center justify-between gap-4 rounded-lg p-4 ring-1 ring-inset', meta.bg, meta.ring)}>
        <div>
          <div className={cn('text-lg font-semibold', meta.text)}>{meta.label}</div>
          <div className="text-xs text-muted-foreground">
            {weather.violationProbability < 0.01 ? '<1%' : fmt.pct(weather.violationProbability)} probability of a weather violation
          </div>
        </div>
        <RiskBadge risk={weather.risk} size="lg" />
      </div>

      <ul className="space-y-3" aria-label="Launch commit criteria">
        {weather.factors.map((f) => {
          const Icon = FACTOR_ICON[f.name] ?? Cloud
          const s = STATUS_STYLE[f.status]
          const fill = Math.min(100, (f.value / (f.limit * 1.25)) * 100)
          return (
            <li key={f.name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Icon aria-hidden className="size-4" />
                  {f.name}
                </span>
                <span className="tabular flex items-baseline gap-2">
                  <span className="font-medium">
                    {f.value}
                    <span className="ml-0.5 text-xs text-muted-foreground">{f.unit}</span>
                  </span>
                  <span className={cn('w-12 text-right text-xs font-semibold', s.text)}>{s.label}</span>
                </span>
              </div>
              {!compact && (
                <div className="relative mt-1.5 h-1 rounded-full bg-secondary" aria-hidden>
                  <div className={cn('absolute inset-y-0 left-0 rounded-full', s.bar)} style={{ width: `${fill}%` }} />
                  {/* Limit marker */}
                  <div className="absolute -top-0.5 h-2 w-px bg-foreground/60" style={{ left: `${100 / 1.25}%` }} />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-[11px] text-muted-foreground">
        {weather.source === 'forecast'
          ? `Open-Meteo forecast for ${fmt.utcDateTime(weather.sample.time)}.`
          : 'Beyond forecast range — estimated from site climatology.'}{' '}
        Simplified launch-commit criteria; tick marks show each limit.
      </p>
    </div>
  )
}
