import type { ReactNode } from 'react'
import type { MissionPlan } from '@/hooks/useMissionPlan'
import { Badge } from '@/components/ui/Badge'
import { fmt } from '@/lib/format'

export default function MissionHeading({
  plan,
  title,
  eyebrow,
  action,
}: {
  plan: MissionPlan
  title: string
  eyebrow: string
  action?: ReactNode
}) {
  const { mission, site, vehicle, forecast } = plan
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">{eyebrow}</p>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>{vehicle.name}</span>
          <span aria-hidden>·</span>
          <span>{site.name}</span>
          <span aria-hidden>·</span>
          <span className="tabular">
            {mission.orbitType} {mission.altitude} km × {fmt.deg(mission.inclination, 2)}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
      {action}
      <Badge>
        <span
          aria-hidden
          className={
            forecast.status === 'live' ? 'size-1.5 rounded-full bg-go' : forecast.status === 'loading' ? 'size-1.5 animate-pulse rounded-full bg-watch' : 'size-1.5 rounded-full bg-muted-foreground'
          }
        />
        {forecast.status === 'live' ? 'Live forecast' : forecast.status === 'loading' ? 'Loading forecast…' : 'Climatology weather'}
      </Badge>
      </div>
    </div>
  )
}
