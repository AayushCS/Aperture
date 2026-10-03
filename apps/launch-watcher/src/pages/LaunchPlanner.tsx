import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Download, RotateCcw, Settings2, Sigma, Target } from 'lucide-react'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  sunSynchronousInclination,
  type ConjunctionScreen,
  type LaunchSiteId,
  type LaunchWindow,
  type OrbitType,
  type VehicleId,
  type WeatherRisk,
} from '@aperture/orbital-core'
import { useMissionPlan } from '@/hooks/useMissionPlan'
import { useMissionStore } from '@/store/mission'
import MissionHeading from '@/components/MissionHeading'
import IssueList from '@/components/IssueList'
import OrbitTrafficPanel from '@/components/OrbitTrafficPanel'
import WeatherPanel from '@/components/WeatherPanel'
import WindowTable, { LightingLabel, ScoreBar, ScreenLabel } from '@/components/WindowTable'
import type { ScreeningState } from '@/store/screening'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { RiskBadge, Stat } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Field, Segmented, SliderField, inputClass } from '@/components/ui/Form'
import { fmt, isoDay } from '@/lib/format'

const ORBIT_OPTIONS: ReadonlyArray<{ value: OrbitType; label: string }> = [
  { value: 'LEO', label: 'LEO' },
  { value: 'POLAR', label: 'Polar' },
  { value: 'SSO', label: 'Sun-sync' },
]

const ORBIT_HELP: Record<OrbitType, string> = {
  LEO: 'Low Earth orbit. Windows open when the pad rotates under the target plane (e.g. ISS rendezvous).',
  POLAR: 'Near-90° inclination for global coverage. One northbound and one southbound opportunity per day.',
  SSO: 'Plane locked to the Sun so the satellite crosses the equator at the same local time every day.',
}

const RISK_OPTIONS: ReadonlyArray<{ value: WeatherRisk; label: string }> = [
  { value: 'low', label: 'Go only' },
  { value: 'medium', label: '≤ Watch' },
  { value: 'high', label: 'Any' },
]

const SPAN_OPTIONS = [3, 7, 14, 30, 60]

function exportCsv(windows: readonly LaunchWindow[], name: string, screens: Record<string, ConjunctionScreen>) {
  const header = ['window_open_utc', 't0_utc', 'window_close_utc', 'duration_s', 'azimuth_deg', 'branch', 'lighting', 'weather_risk', 'weather_violation_prob', 'weather_source', 'score', 'conjunction_screen']
  const rows = windows.map((w) => [
    w.start.toISOString(),
    w.optimal.toISOString(),
    w.end.toISOString(),
    w.duration,
    w.azimuth,
    w.branch,
    w.lighting.plumeSunlit ? 'sunlit-plume' : w.lighting.condition,
    w.weatherRisk,
    w.weather.violationProbability,
    w.weather.source,
    w.quality,
    // Quoted: object names are free text
    `"${(screens[w.id] ? (screens[w.id]!.reason ?? 'clear') : 'not screened').replace(/"/g, '""')}"`,
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
  const { mission, analysis, windows, focus, site, vehicle, screening } = plan
  const { update, applyOrbitPreset, selectWindow, reset, selectedWindowId } = useMissionStore()
  const ssoInc = sunSynchronousInclination(mission.altitude)
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
        {/* ---------------- Configuration ---------------- */}
        <Card className="lg:col-span-3">
          <CardHeader icon={<Settings2 />} title="Mission profile" description="Changes recalculate instantly and are saved in this browser" />
          <CardBody className="space-y-6">
            <Field label="Mission name" htmlFor="mission-name">
              <input
                id="mission-name"
                className={inputClass}
                value={mission.name}
                maxLength={60}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Orbit family</span>
              <Segmented label="Orbit family" value={mission.orbitType} options={ORBIT_OPTIONS} onChange={applyOrbitPreset} />
              <p className="text-xs text-muted-foreground">{ORBIT_HELP[mission.orbitType]}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField id="altitude" label="Altitude" unit="km" min={160} max={2000} step={10} value={mission.altitude} onChange={(altitude) => update({ altitude })} />
              <SliderField
                id="inclination"
                label="Inclination"
                unit="°"
                min={0}
                max={140}
                step={0.01}
                value={mission.inclination}
                onChange={(inclination) => update({ inclination })}
                hint={
                  mission.orbitType === 'SSO' ? (
                    <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => update({ inclination: Number(ssoInc.toFixed(2)) })}>
                      Use sun-synchronous value {fmt.deg(ssoInc, 2)}
                    </button>
                  ) : (
                    `Reachable from ${site.name}: ${fmt.deg(Math.abs(site.latitude))}–${fmt.deg(180 - Math.abs(site.latitude))}`
                  )
                }
              />
              {mission.orbitType === 'SSO' ? (
                <SliderField
                  id="ltan"
                  label="Local time of ascending node"
                  unit="h"
                  min={0}
                  max={24}
                  step={0.25}
                  value={mission.ltan}
                  onChange={(ltan) => update({ ltan })}
                  hint={`Descending node at ${((mission.ltan + 12) % 24).toFixed(2)} h local solar time`}
                />
              ) : (
                <SliderField
                  id="raan"
                  label="Target RAAN (1 Jan 2026 epoch)"
                  unit="°"
                  min={0}
                  max={360}
                  step={0.5}
                  value={mission.raan}
                  onChange={(raan) => update({ raan })}
                  hint="Right ascension of the ascending node; precesses with J2"
                />
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Launch site" htmlFor="site">
                <select id="site" className={inputClass} value={mission.siteId} onChange={(e) => update({ siteId: e.target.value as LaunchSiteId })}>
                  {Object.entries(COMMON_LAUNCH_SITES).map(([id, s]) => (
                    <option key={id} value={id}>
                      {s.name} ({fmt.lat(s.latitude)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Launch vehicle" htmlFor="vehicle" hint={`Ascent to insertion ${fmt.duration(vehicle.ascentDuration)} · max ${vehicle.maxAltitude} km`}>
                <select id="vehicle" className={inputClass} value={mission.vehicleId} onChange={(e) => update({ vehicleId: e.target.value as VehicleId })}>
                  {Object.entries(COMMON_VEHICLES).map(([id, v]) => (
                    <option key={id} value={id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Search from (UTC)" htmlFor="start" hint={mission.startDate ? undefined : 'Defaults to now'}>
                <input
                  id="start"
                  type="date"
                  className={inputClass}
                  value={mission.startDate || isoDay(new Date())}
                  onChange={(e) => update({ startDate: e.target.value })}
                />
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
                <input
                  type="checkbox"
                  className="size-4 accent-[hsl(var(--primary))]"
                  checked={mission.daylightOnly}
                  onChange={(e) => update({ daylightOnly: e.target.checked })}
                />
                Daylight launches only
              </label>
            </div>
          </CardBody>
        </Card>

        {/* ---------------- Analysis ---------------- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<Sigma />}
              title="Mission analysis"
              action={
                <span className={analysis.feasible ? 'text-xs font-semibold text-go' : 'text-xs font-semibold text-nogo'}>
                  {analysis.feasible ? 'Feasible' : 'Not feasible'}
                </span>
              }
            />
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Period" value={`${analysis.periodMinutes.toFixed(1)} min`} hint={`${(1440 / analysis.periodMinutes).toFixed(2)} rev/day`} />
                <Stat label="Velocity" value={`${analysis.velocityKmS.toFixed(2)} km/s`} hint="Circular orbit" />
                <Stat label="Node drift (J2)" value={`${analysis.nodalPrecessionDegDay.toFixed(3)}°/d`} hint={analysis.nodalPrecessionDegDay < 0 ? 'Westward' : 'Eastward'} />
                <Stat label="Track shift" value={fmt.deg(analysis.groundTrackShiftDeg, 2)} hint="West per revolution" />
              </dl>
              {analysis.opportunities.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Launch opportunities per day</h3>
                  <ul className="divide-y rounded-lg border text-sm">
                    {analysis.opportunities.map((o) => (
                      <li key={o.branch} className="tabular flex items-center justify-between px-3 py-2">
                        <span className="capitalize">{o.branch} pass</span>
                        <span className="flex items-center gap-3">
                          <span>{fmt.deg(o.azimuth)}</span>
                          <span className="text-xs text-muted-foreground">
                            {o.rotationalGain >= 0 ? '+' : ''}
                            {(o.rotationalGain * 1000).toFixed(0)} m/s
                          </span>
                          <span className={o.withinCorridor ? 'w-16 text-right text-xs text-go' : 'w-16 text-right text-xs text-nogo'}>
                            {o.withinCorridor ? 'Allowed' : 'Restricted'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">m/s = velocity gained (or lost) from Earth's rotation; “Restricted” = outside range-safety corridor.</p>
                </div>
              )}
              <IssueList issues={analysis.issues} />
            </CardBody>
          </Card>

          <OrbitTrafficPanel altitude={mission.altitude} inclination={mission.inclination} screening={screening} />

          {focus && <WindowDetail window={focus} selected={focus.id === selectedWindowId} screen={screening.results[focus.id]} screeningStatus={screening.status} />}
        </div>
      </div>

      {/* ---------------- Results ---------------- */}
      <Card>
        <CardHeader
          icon={<Target />}
          title={`${windows.length} launch windows`}
          description={
            windows.length
              ? `${goCount} with GO weather · ${fmt.utcDate(plan.input.dateRange.start)} – ${fmt.utcDate(plan.input.dateRange.end)}`
              : 'No windows match the current profile and constraints'
          }
          action={
            <Button variant="outline" size="sm" disabled={!windows.length} onClick={() => exportCsv(windows, mission.name, screening.results)}>
              <Download aria-hidden /> Export CSV
            </Button>
          }
        />
        <div className="mt-3 max-h-[560px] overflow-y-auto">
          {windows.length > 0 ? (
            <WindowTable windows={windows} selectedId={focus?.id} onSelect={selectWindow} caption="Calculated launch windows" screening={screening} />
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Try relaxing the weather or daylight constraints, widening the span, or resolving the issues above.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function WindowDetail({
  window: w,
  selected,
  screen,
  screeningStatus,
}: {
  window: LaunchWindow
  selected: boolean
  screen?: ConjunctionScreen
  screeningStatus: ScreeningState['status']
}) {
  const b = w.scoreBreakdown
  return (
    <Card>
      <CardHeader
        title={selected ? 'Selected window' : 'Next window'}
        description={`${fmt.utcDateTime(w.optimal)} · ${fmt.local(w.optimal)}`}
        action={<RiskBadge risk={w.weatherRisk} />}
      />
      <CardBody className="space-y-5">
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Opens" value={fmt.utcTime(w.start)} />
          <Stat label="Closes" value={fmt.utcTime(w.end)} />
          <Stat label="Azimuth" value={fmt.deg(w.azimuth)} hint={`${w.branch} pass`} />
          <Stat label="Lighting" value={<LightingLabel window={w} />} hint={`Sun ${fmt.deg(w.lighting.sunElevation)} at pad`} />
          <Stat label="Insertion" value={fmt.utcTime(w.insertion.time)} hint={`${fmt.lat(w.insertion.latitude)} ${fmt.lon(w.insertion.longitude)}`} />
          <Stat label="RAAN" value={fmt.deg(w.raan, 2)} hint="At insertion" />
          <Stat
            className="col-span-2"
            label="Conjunction screen"
            value={<ScreenLabel screen={screen} status={screeningStatus} />}
            hint={
              screen?.closest
                ? `${screen.blocked ? screen.reason : `Closest ${screen.closest.distanceKm.toFixed(1)} km from ${screen.closest.name}`} at ${fmt.utcTime(screen.closest.time)}`
                : '3 h after insertion · 25 km (200 km ISS/Tiangong)'
            }
          />
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
