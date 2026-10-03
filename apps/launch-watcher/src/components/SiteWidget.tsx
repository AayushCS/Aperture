import { useMemo } from 'react'
import { MapPin, Rocket } from 'lucide-react'
import { orbitalEngine, type LaunchOpportunity } from '@aperture/orbital-core'
import { useMissionStore } from '@/store/mission'
import { SITE, buildInput } from '@/hooks/useMissionPlan'
import { Dialog } from '@/components/ui/Dialog'
import { Stat } from '@/components/ui/Badge'
import CorridorCompass from '@/components/CorridorCompass'
import { useNow } from '@/hooks/useNow'
import { fmt } from '@/lib/format'
import { cn } from '@/utils/cn'

/** Public milestones (approximate dates); later entries are targets, not facts */
export const SITE_TIMELINE: ReadonlyArray<{ date: Date; label: string }> = [
  { date: new Date('2017-03-14'), label: 'Canso selected as the launch site' },
  { date: new Date('2022-08-01'), label: 'Final approval; construction begins' },
  { date: new Date('2023-07-01'), label: 'York University Goose 3 — first suborbital flight' },
  { date: new Date('2025-11-01'), label: 'T-Minus Barracuda suborbital flight' },
  { date: new Date('2026-03-16'), label: '$200 M federal sovereign-launch investment' },
  { date: new Date('2026-06-01'), label: 'Second Barracuda flight' },
  { date: new Date('2027-10-01'), label: 'Orbital launches targeted (late 2027)' },
]

export const SITE_FACTS = {
  operator: 'Maritime Launch Services',
  area: '335 acres on the Atlantic coast near Canso and Little Dover',
  inclinations: '≈45°–98° (polar, sun-synchronous and LEO)',
  trajectory: 'East and south over open ocean',
}

/** Site details dialog (opened from site cards and the globe marker) */
export function SiteDialog() {
  const inspecting = useMissionStore((s) => s.inspecting)
  const mission = useMissionStore((s) => s.mission)
  const opportunities = useMemo(
    () => orbitalEngine.analyzeMission(buildInput(mission)).opportunities,
    [mission]
  )
  const inspect = useMissionStore((s) => s.inspect)
  const now = useNow(60_000)
  const operational = SITE.operationalFrom ? now >= SITE.operationalFrom : true

  return (
    <Dialog
      open={inspecting === 'site'}
      onClose={() => inspect(null)}
      icon={<MapPin />}
      title={SITE.name}
      description={`${SITE_FACTS.operator} · ${fmt.lat(SITE.latitude)} ${fmt.lon(SITE.longitude)}`}
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Status" value={operational ? 'Orbital-capable' : 'Suborbital only'} hint={operational ? 'Per planning assumption' : `Orbital from ~${fmt.utcDate(SITE.operationalFrom!)}`} />
            <Stat label="Inclinations" value="45°–98°" hint="Direct ascent" />
            <Stat label="Corridor" value={(SITE.azimuthCorridors ?? []).map(([a, b]) => `${a}°–${b}°`).join(', ')} hint={SITE_FACTS.trajectory} />
            <Stat label="Climate" value="N. Atlantic" hint="Windy winters, sea fog" />
          </dl>
          <div className="rounded-xl border border-white/5 bg-black/30 p-2">
            <CorridorCompass site={SITE} opportunities={opportunities} size={170} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Canada's first commercial orbital spaceport, on a {SITE_FACTS.area}. Flights head over the Atlantic, so the eastern and southern
          azimuths needed for {SITE_FACTS.inclinations} cross no land at low altitude.
        </p>
        <ol className="relative space-y-3 border-l border-white/10 pl-5">
          {SITE_TIMELINE.map((m) => {
            const past = m.date <= now
            return (
              <li key={m.label} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    'absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-background',
                    past ? 'bg-primary' : 'animate-pulse bg-watch'
                  )}
                />
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {m.date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })} {past ? '' : '· target'}
                </div>
                <div className="text-sm">{m.label}</div>
              </li>
            )
          })}
        </ol>
        <p className="text-[11px] text-muted-foreground">
          The corridor is a representative planning value, not an official range rule. Dates after today are targets.
        </p>
      </div>
    </Dialog>
  )
}

/** Clickable site summary card */
export function SiteCard({ opportunities, className }: { opportunities?: readonly LaunchOpportunity[]; className?: string }) {
  const inspect = useMissionStore((s) => s.inspect)
  const now = useNow(60_000)
  const operational = SITE.operationalFrom ? now >= SITE.operationalFrom : true
  const daysToOrbital = SITE.operationalFrom ? Math.ceil((SITE.operationalFrom.getTime() - now.getTime()) / 86_400_000) : 0

  return (
    <button
      type="button"
      onClick={() => inspect('site')}
      className={cn(
        'glass-panel group relative w-full overflow-hidden rounded-xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10',
        className
      )}
      aria-haspopup="dialog"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <div className="w-24 shrink-0">
          <CorridorCompass site={SITE} opportunities={opportunities} size={110} />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <Rocket className="size-3.5" aria-hidden /> Launch site
          </div>
          <div className="truncate font-semibold">{SITE.name}</div>
          <div className="tabular text-xs text-muted-foreground">
            {fmt.lat(SITE.latitude)} {fmt.lon(SITE.longitude)} · Canso, NS
          </div>
          <div className="pt-1 text-xs">
            {operational ? (
              <span className="text-go">Orbital operations (assumed)</span>
            ) : (
              <span className="text-watch">Orbital-ready in ~{daysToOrbital} days</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground transition-colors group-hover:text-primary">Details →</div>
        </div>
      </div>
    </button>
  )
}