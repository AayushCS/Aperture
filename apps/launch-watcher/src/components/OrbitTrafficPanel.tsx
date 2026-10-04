import { Orbit } from 'lucide-react'
import type { ScreeningState } from '@/store/screening'
import { DEFAULT_TRAFFIC_TOLERANCE as TOL, SCREEN_DEFAULTS, SCREEN_DISTANCE_KM } from '@aperture/orbital-core'
import { useOrbitTraffic } from '@/hooks/useOrbitTraffic'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Badge'
import { fmt } from '@/lib/format'

/** Active satellites sharing the target altitude shell and inclination, from the saved CelesTrak snapshot */
export default function OrbitTrafficPanel({
  altitude,
  inclination,
  screening,
}: {
  altitude: number
  inclination: number
  screening: ScreeningState
}) {
  const state = useOrbitTraffic(altitude, inclination)

  return (
    <Card>
      <CardHeader
        icon={<Orbit />}
        title="Orbit traffic"
        description={`Active objects within ${altitude - TOL.altitudeKm}–${altitude + TOL.altitudeKm} km and ${fmt.deg(inclination, 2)} ± ${TOL.inclinationDeg}°`}
      />
      {state.status === 'missing' ? (
        <CardBody className="text-sm text-muted-foreground">
          No satellite snapshot found. Run <code className="rounded bg-secondary px-1 py-0.5 text-xs">bun run data:satellites</code> to save
          CelesTrak's active catalogue to <code className="rounded bg-secondary px-1 py-0.5 text-xs">data/active.json</code>.
        </CardBody>
      ) : state.status === 'error' ? (
        <CardBody className="text-sm text-nogo">{state.message}</CardBody>
      ) : state.status === 'loading' ? (
        <CardBody className="text-sm text-muted-foreground">Loading satellite snapshot…</CardBody>
      ) : (
        <>
          <CardBody className="pb-3">
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Sharing this orbit" value={state.traffic.matches.toLocaleString()} hint="Perigee–apogee overlaps the shell" />
              <Stat
                label="Catalogue"
                value={state.traffic.total.toLocaleString()}
                hint={state.traffic.medianEpoch ? `Elements from ~${fmt.utcDate(state.traffic.medianEpoch)}` : 'Active objects'}
              />
            </dl>
          </CardBody>
          {state.traffic.closest.length > 0 ? (
            <div className="overflow-x-auto pb-2">
              <table className="w-full min-w-[480px] text-sm">
                <caption className="sr-only">Objects closest to the target altitude</caption>
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="py-2 pl-5 pr-3 font-medium">Object</th>
                    <th scope="col" className="px-3 py-2 font-medium">Perigee – apogee</th>
                    <th scope="col" className="px-3 py-2 font-medium">Inclination</th>
                    <th scope="col" className="py-2 pl-3 pr-5 text-right font-medium">Δ altitude</th>
                  </tr>
                </thead>
                <tbody>
                  {state.traffic.closest.map((o) => {
                    const delta = o.meanAltitude - altitude
                    return (
                      <tr key={o.noradId} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pl-5 pr-3">
                          <span className="block font-medium">{o.name}</span>
                          <span className="tabular block text-[11px] text-muted-foreground">NORAD {o.noradId}</span>
                        </td>
                        <td className="tabular px-3 py-2 text-muted-foreground">
                          {Math.round(o.perigee)} – {fmt.km(o.apogee)}
                        </td>
                        <td className="tabular px-3 py-2">{fmt.deg(o.inclination, 2)}</td>
                        <td className="tabular py-2 pl-3 pr-5 text-right">
                          {delta >= 0 ? '+' : '−'}
                          {fmt.km(Math.abs(delta))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No catalogued objects share this shell and inclination.</p>
          )}
          <p className="px-5 pb-4 text-[11px] text-muted-foreground">
            CelesTrak active-satellite snapshot (saved locally, not live). Δ altitude compares the mean orbit altitude to the target.
          </p>
          <ConjunctionSummary screening={screening} />
        </>
      )}
    </Card>
  )
}

function ConjunctionSummary({ screening }: { screening: ScreeningState }) {
  const results = Object.values(screening.results)
  const blocked = results.filter((r) => r.blocked).length
  return (
    <div className="space-y-1.5 border-t px-5 py-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Conjunction screen</h3>
      <p className="text-sm">
        {screening.status === 'error' ? (
          <span className="text-nogo">{screening.error}</span>
        ) : screening.total === 0 ? (
          <span className="text-muted-foreground">No windows to screen.</span>
        ) : (
          <>
            <span className={blocked ? 'font-semibold text-amber-400' : 'font-semibold text-go'}>
              {blocked} of {results.length}
            </span>{' '}
            windows have a close pass at nominal liftoff
            {screening.status === 'running' && <span className="text-muted-foreground"> · screening {results.length}/{screening.total}…</span>}
          </>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">Simplified screen based on FAA 450.169 distances, after orbit insertion only.</p>
      <p className="text-[11px] text-muted-foreground">A short liftoff hold normally shifts a single close pass; hold times are not computed yet.</p>
      <p className="text-[11px] text-muted-foreground">
        Payload flown 3 h from insertion against objects within ±{SCREEN_DEFAULTS.altitudeBandKm} km (SGP4, {SCREEN_DEFAULTS.stepSec} s steps). Limits:{' '}
        {SCREEN_DISTANCE_KM.other} km, {SCREEN_DISTANCE_KM.habitable} km for ISS and Tiangong. Accuracy falls off as the snapshot ages.
      </p>
    </div>
  )
}
