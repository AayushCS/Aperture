import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Download, FileCode2, Orbit, RotateCcw, Settings2, Sigma, Target } from 'lucide-react'
import { COMMON_VEHICLES, type LaunchWindow, type VehicleId, type WeatherRisk } from '@aperture/orbital-core'
import { useMissionPlan } from '@/hooks/useMissionPlan'
import { useMissionStore } from '@/store/mission'
import MissionHeading from '@/components/MissionHeading'
import IssueList from '@/components/IssueList'
import WeatherPanel from '@/components/WeatherPanel'
import WindowTable, { LightingLabel, ScoreBar } from '@/components/WindowTable'
import OrbitForm from '@/components/OrbitForm'
import { GeneratedTle } from '@/components/TleDialog'
import EllipseDiagram from '@/components/EllipseDiagram'
import { SiteCard } from '@/components/SiteWidget'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { RiskBadge, Stat } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Field, Segmented, inputClass } from '@/components/ui/Form'
import { CLASS_LABEL, hhmm } from '@/lib/orbitStats'
import { fmt, isoDay } from '@/lib/format'

const RISK_OPTIONS: ReadonlyArray<{ value: WeatherRisk; label: string }> = [
  { value: 'low', label: 'Go only' },
  { value: 'medium', label: '≤ Watch' },
  { value: 'high', label: 'Any' },
]

const SPAN_OPTIONS = [3, 7, 14, 30, 60]

function exportCsv(windows: readonly LaunchWindow[], name: string) {
  const header = ['window_open_utc', 't0_utc', 'window_close_utc', 'duration_s', 'azimuth_deg', 'branch', 'insertion_alt_km', 'lighting', 'weather_risk', 'weather_violation_prob', 'weather_source', 'score']
  const rows = windows.map((w) => [
    w.start.toISOString(),
    w.optimal.toISOString(),
    w.end.toISOString(),
    w.duration,
    w.azimuth,
    w.branch,
    w.insertion.altitude.toFixed(1),
    w.lighting.plumeSunlit ? 'sunlit-plume' : w.lighting.condition,
    w.weatherRisk,
    w.weather.violationProbability,
    w.weather.source,
    w.quality,
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${(name || 'mission').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-windows.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`Exported ${windows.length} windows`)
}

export default function LaunchPlanner() {
  const plan = useMissionPlan()
  const { mission, analysis, windows, focus, vehicle, orbit } = plan
  const { update, selectWindow, reset, selectedWindowId } = useMissionStore()
  const goCount = windows.filter((w) => w.weatherRisk === 'low').length

  return (
    <div className="space-y-6">
      <MissionHeading
        plan={plan}
        eyebrow="Window planner"
        title={mission.name || 'Untitled mission'}
        action={
          <Button variant="ghost" size="sm" onClick={() => { reset(); toast('Mission reset to defaults') }}>
            <RotateCcw aria-hidden /> Reset
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
            <CardHeader icon={<Orbit />} title="Target orbit" description="Choose the orbit type and shape. It is designed to inject at perigee from Canso." />
            <CardBody>
              <OrbitForm analysis={analysis} />
            </CardBody>
          </Card>

          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
            <CardHeader icon={<FileCode2 />} title="Generated TLE" description="One orbit, produced from your inputs and the selected launch window" />
            <CardBody>
              <GeneratedTle plan={plan} />
            </CardBody>
          </Card>

          <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-1000">
            <CardHeader icon={<Settings2 />} title="Launch & search" description="Saved in this browser" />
            <CardBody className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Mission name" htmlFor="mission-name">
                  <input id="mission-name" className={inputClass} value={mission.name} maxLength={60} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field label="Launch vehicle" htmlFor="vehicle" hint={`Ascent ${fmt.duration(vehicle.ascentDuration)} · apogee ≤ ${vehicle.maxAltitude} km · ${vehicle.minInclination}°–${vehicle.maxInclination}°`}>
                  <select id="vehicle" className={inputClass} value={mission.vehicleId} onChange={(e) => update({ vehicleId: e.target.value as VehicleId })}>
                    {Object.entries(COMMON_VEHICLES).map(([id, v]) => (
                      <option key={id} value={id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Search from (UTC)" htmlFor="start" hint={mission.startDate ? undefined : 'Defaults to now'}>
                  <input id="start" type="date" className={inputClass} value={mission.startDate || isoDay(new Date())} onChange={(e) => update({ startDate: e.target.value })} />
                </Field>
                <Field label="Search span" htmlFor="span">
                  <select id="span" className={inputClass} value={mission.spanDays} onChange={(e) => update({ spanDays: Number(e.target.value) })}>
                    {SPAN_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} days
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Maximum weather risk</span>
                  <Segmented label="Maximum weather risk" value={mission.maxWeatherRisk} options={RISK_OPTIONS} onChange={(maxWeatherRisk) => update({ maxWeatherRisk })} />
                </div>
                <label className="flex cursor-pointer items-center gap-3 self-end rounded-lg border bg-background/40 px-3 py-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={mission.daylightOnly} onChange={(e) => update({ daylightOnly: e.target.checked })} />
                  Daylight launches only
                </label>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <SiteCard opportunities={analysis.opportunities} className="animate-in fade-in-0 slide-in-from-right-4 duration-500" />

          <Card className="animate-in fade-in-0 slide-in-from-right-4 duration-700">
            <CardHeader
              icon={<Sigma />}
              title="Mission analysis"
              description={CLASS_LABEL[analysis.orbitClass]}
              action={
                <span className={analysis.feasible ? 'text-xs font-semibold text-go' : 'text-xs font-semibold text-nogo'}>
                  {analysis.feasible ? 'Feasible' : 'Not feasible'}
                </span>
              }
            />
            <CardBody className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-black/30 px-4 py-2">
                <EllipseDiagram orbit={orbit} exaggerate={orbit.eccentricity < 0.05 ? 10 : 1} size={260} insertionTrueAnomaly={focus?.insertion.trueAnomaly} />
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Perigee × apogee" value={`${Math.round(analysis.perigeeAltitudeKm)} × ${Math.round(analysis.apogeeAltitudeKm)} km`} hint={`e = ${orbit.eccentricity.toFixed(4)}`} />
                <Stat label="Period" value={`${analysis.periodMinutes.toFixed(1)} min`} hint={`${analysis.revsPerDay.toFixed(2)} rev/day`} />
                <Stat label="Node drift (J2)" value={`${analysis.nodalPrecessionDegDay.toFixed(3)}°/d`} hint={analysis.sunSynchronous ? `Sun-locked · LTAN ${hhmm(analysis.ltan)}` : analysis.nodalPrecessionDegDay < 0 ? 'Westward' : 'Eastward'} />
                <Stat label="Perigee drift" value={`${analysis.apsidalPrecessionDegDay.toFixed(2)}°/d`} hint="Apsidal rotation" />
                <Stat label="Speed" value={`${analysis.perigeeVelocityKmS.toFixed(2)} km/s`} hint={`${analysis.apogeeVelocityKmS.toFixed(2)} at apogee`} />
                <Stat label="Track shift" value={fmt.deg(analysis.groundTrackShiftDeg, 2)} hint="West per revolution" />
              </dl>
              {analysis.opportunities.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Launch opportunities per day</h3>
                  <ul className="divide-y rounded-lg border text-sm">
                    {analysis.opportunities.map((o) => (
                      <li key={o.branch} className="tabular flex items-center justify-between gap-2 px-3 py-2">
                        <span className="capitalize">{o.branch === 'ascending' ? 'Northbound' : 'Southbound'}</span>
                        <span className="flex items-center gap-3">
                          <span>{fmt.deg(o.azimuth)}</span>
                          <span className="text-xs text-muted-foreground">ins. {Math.round(o.insertionAltitude)} km</span>
                          <span className={o.withinCorridor ? 'w-16 text-right text-xs text-go' : 'w-16 text-right text-xs text-nogo'}>
                            {o.withinCorridor ? 'Allowed' : 'Restricted'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">“Restricted” = outside the spaceport's over-ocean corridor. “ins.” = altitude where the ascent meets the ellipse.</p>
                </div>
              )}
              <IssueList issues={analysis.issues} />
            </CardBody>
          </Card>

          {focus && <WindowDetail window={focus} selected={focus.id === selectedWindowId} />}
        </div>
      </div>

      <Card>
        <CardHeader
          icon={<Target />}
          title={`${windows.length} launch windows`}
          description={
            windows.length
              ? `${goCount} with GO weather · ${fmt.utcDate(plan.input.dateRange.start)} – ${fmt.utcDate(plan.input.dateRange.end)}`
              : 'No windows match the current orbit and constraints'
          }
          action={
            <Button variant="outline" size="sm" disabled={!windows.length} onClick={() => exportCsv(windows, mission.name)}>
              <Download aria-hidden /> Export CSV
            </Button>
          }
        />
        <div className="mt-3 max-h-[560px] overflow-y-auto">
          {windows.length > 0 ? (
            <WindowTable windows={windows} selectedId={focus?.id} onSelect={selectWindow} caption="Calculated launch windows" />
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Try relaxing the weather or daylight constraints, widening the span, or resolving the issues above.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function WindowDetail({ window: w, selected }: { window: LaunchWindow; selected: boolean }) {
  const b = w.scoreBreakdown
  return (
    <Card>
      <CardHeader title={selected ? 'Selected window' : 'Next window'} description={`${fmt.utcDateTime(w.optimal)} · ${fmt.local(w.optimal)}`} action={<RiskBadge risk={w.weatherRisk} />} />
      <CardBody className="space-y-5">
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Opens" value={fmt.utcTime(w.start)} />
          <Stat label="Closes" value={fmt.utcTime(w.end)} />
          <Stat label="Azimuth" value={fmt.deg(w.azimuth)} hint={`${w.branch} pass`} />
          <Stat label="Lighting" value={<LightingLabel window={w} />} hint={`Sun ${fmt.deg(w.lighting.sunElevation)} at pad`} />
          <Stat label="Insertion" value={fmt.utcTime(w.insertion.time)} hint={`${fmt.km(w.insertion.altitude)} · ν ${fmt.angle(w.insertion.trueAnomaly, 1)}`} />
          <Stat label="RAAN" value={fmt.deg(w.raan, 2)} hint="Target plane at insertion" />
        </dl>
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Score breakdown</h3>
          <dl className="space-y-1.5 text-sm">
            {(
              [
                ['Weather (50%)', b.weather],
                ['Performance (20%)', b.performance],
                ['Corridor margin (15%)', b.corridor],
                ['Public viewing (15%)', b.viewing],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>
                  <ScoreBar value={value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <WeatherPanel weather={w.weather} compact />
        <Link to="/orbit" className={buttonVariants({ variant: 'secondary', className: 'w-full' })}>
          Visualise this window <ArrowRight aria-hidden />
        </Link>
      </CardBody>
    </Card>
  )
}