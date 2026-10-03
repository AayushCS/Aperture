import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, Eye, FileCode2, MapPinned, Orbit, Radar, Rocket, Satellite, ShieldAlert } from 'lucide-react'
import { formatTle, type LaunchWindow } from '@aperture/orbital-core'
import { useMissionPlan, type MissionPlan } from '@/hooks/useMissionPlan'
import EllipseDiagram from '@/components/EllipseDiagram'
import { FamilyPicker } from '@/components/OrbitForm'
import { SiteCard } from '@/components/SiteWidget'
import { CLASS_COLOR, CLASS_LABEL, hhmm } from '@/lib/orbitStats'
import MissionHeading from '@/components/MissionHeading'
import CountdownTimer from '@/components/CountdownTimer'
import WeatherPanel from '@/components/WeatherPanel'
import ViewingMap, { QUALITY_META } from '@/components/ViewingMap'
import WindowTable, { LightingLabel } from '@/components/WindowTable'
import IssueList from '@/components/IssueList'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { useMissionStore } from '@/store/mission'
import { fmt } from '@/lib/format'

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
const compassPoint = (az: number) => COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16]

export default function Dashboard() {
  const plan = useMissionPlan()
  const selectWindow = useMissionStore((s) => s.selectWindow)
  const navigate = useNavigate()
  const { analysis, windows, next, site, mission, screening } = plan
  const nextScreen = next ? screening.results[next.id] : undefined

  return (
    <div className="space-y-6">
      <MissionHeading plan={plan} eyebrow="Launch watch" title={mission.name || 'Untitled mission'} />

      {!next ? (
        <Card>
          <CardBody className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <Radar aria-hidden className="size-5 text-muted-foreground" />
              <h2 className="font-semibold">No launch windows in the search range</h2>
            </div>
            {analysis.issues.length > 0 ? (
              <IssueList issues={analysis.issues} className="w-full" />
            ) : (
              <p className="text-sm text-muted-foreground">
                All opportunities were filtered out by the lighting or weather constraints. Relax them or widen the date range.
              </p>
            )}
            <Link to="/planner" className={buttonVariants()}>
              Adjust mission <ArrowRight aria-hidden />
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="glow-border lg:col-span-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
              <CardHeader
                icon={<Rocket />}
                title="Next launch window"
                description={`${fmt.utcDate(next.optimal)} · ${fmt.local(next.optimal)}`}
                action={<LightingLabel window={next} />}
              />
              <CardBody className="space-y-5">
                <CountdownTimer window={next} />
                {nextScreen?.blocked && (
                  <p role="alert" className="flex gap-2.5 rounded-lg bg-nogo/10 px-3 py-2.5 text-sm text-red-200 ring-1 ring-inset ring-nogo/30">
                    <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-nogo" />
                    <span>
                      Blocked — {nextScreen.reason}. <span className="text-muted-foreground">Simplified post-insertion screen.</span>
                    </span>
                  </p>
                )}
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Flight azimuth" value={fmt.deg(next.azimuth)} hint={`${compassPoint(next.azimuth)} · ${next.branch} pass`} />
                  <Stat label="Window width" value={fmt.duration(next.duration)} hint="In-plane ± tolerance" />
                  <Stat label="Insertion" value={`T+${fmt.duration(next.insertion.time.getTime() / 1000 - next.optimal.getTime() / 1000)}`} hint={`${fmt.lat(next.insertion.latitude)} ${fmt.lon(next.insertion.longitude)}`} />
                  <Stat label="Window score" value={`${Math.round(next.quality * 100)} / 100`} hint={`${windows.length} windows in ${mission.spanDays} days`} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon={<Satellite />} title="Weather at T-0" description="Launch-commit criteria for the next window" />
              <CardBody>
                <WeatherPanel weather={next.weather} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <MissionOrbitWidget plan={plan} />
            <SiteCard opportunities={analysis.opportunities} className="h-full animate-in fade-in-0 slide-in-from-bottom-2 duration-700" />
            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-1000">
              <CardHeader
                icon={<Orbit />}
                title="Orbit type"
                description="Switch family — windows and TLE update instantly"
                action={
                  <Link to="/planner" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    Tune <ArrowRight aria-hidden />
                  </Link>
                }
              />
              <CardBody className="pt-4">
                <FamilyPicker className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3" />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader icon={<MapPinned />} title="Where to watch" description="Ascent ground path and viewing zones for the next window" />
              <CardBody>
                <ViewingMap site={site} window={next} />
              </CardBody>
            </Card>
            <ViewingGuide window={next} />
          </div>

          <Card>
            <CardHeader
              icon={<Compass />}
              title="Upcoming windows"
              description="Select a window to inspect it in the planner"
              action={
                <Link to="/planner" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  All windows <ArrowRight aria-hidden />
                </Link>
              }
            />
            <div className="mt-3">
              <WindowTable
                windows={windows}
                limit={7}
                caption="Upcoming launch windows"
                screening={screening}
                selectedId={undefined}
                onSelect={(id) => {
                  selectWindow(id)
                  navigate('/planner')
                }}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function ViewingGuide({ window: w }: { window: LaunchWindow }) {
  const direction = compassPoint(w.azimuth)
  const tip = w.lighting.plumeSunlit
    ? 'Dark sky with the plume lit by the Sun at altitude — expect a glowing "jellyfish" exhaust cloud.'
    : w.lighting.condition === 'night'
      ? 'Night launch: the engine flame is visible from far downrange. Look for a bright moving point.'
      : w.lighting.condition === 'twilight'
        ? 'Twilight launch: good contrast for the exhaust trail against a darkening sky.'
        : 'Daytime launch: best seen within the prime zone; bring binoculars for staging.'

  return (
    <Card>
      <CardHeader icon={<Eye />} title="Viewing guide" description={`Look ${direction} (${fmt.deg(w.azimuth, 0)}) from the launch site`} />
      <CardBody className="space-y-4">
        <ol className="space-y-3">
          {w.visibilityRegions.map((r) => {
            const q = QUALITY_META[r.quality ?? 'medium']
            return (
              <li key={r.label} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: q.color }} />
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-xs" style={{ color: q.color }}>
                      {q.label}
                    </span>
                  </div>
                  <div className="tabular text-xs text-muted-foreground">
                    Within {fmt.km(r.radius)} of {fmt.lat(r.latitude)} {fmt.lon(r.longitude)}
                  </div>
                  <div className="tabular text-xs text-muted-foreground">
                    T+{fmt.duration((r.visibilityStart.getTime() - w.optimal.getTime()) / 1000)} → T+
                    {fmt.duration((r.visibilityEnd.getTime() - w.optimal.getTime()) / 1000)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="rounded-lg bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">{tip}</p>
      </CardBody>
    </Card>
  )
}

/** Clickable mission-orbit widget: TLE at a glance, orbit shape, opens the inspector */
function MissionOrbitWidget({ plan }: { plan: MissionPlan }) {
  const inspect = useMissionStore((s) => s.inspect)
  const { analysis, orbit, tle, mission } = plan
  const color = CLASS_COLOR[analysis.orbitClass]
  const [l1, l2] = formatTle(tle)
  return (
    <button
      type="button"
      onClick={() => inspect('mission')}
      aria-haspopup="dialog"
      className="glass-panel group relative overflow-hidden rounded-xl p-5 text-left transition-all animate-in fade-in-0 slide-in-from-bottom-2 duration-500 hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-lg hover:shadow-violet-500/10"
    >
      <div className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-violet-300">
          <Orbit className="size-3.5" aria-hidden /> Mission orbit
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color, backgroundColor: `${color}22` }}>
          {mission.orbitType}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-4">
        <div className="w-28 shrink-0">
          <EllipseDiagram orbit={orbit} color={color} size={120} labels={false} exaggerate={orbit.eccentricity < 0.05 ? 10 : 1} />
        </div>
        <div className="min-w-0 space-y-1 text-sm">
          <div className="truncate font-semibold">{tle.name ?? `#${tle.catalogNumber}`}</div>
          <div className="tabular text-xs text-muted-foreground">
            {Math.round(analysis.perigeeAltitudeKm)} × {Math.round(analysis.apogeeAltitudeKm)} km · {orbit.inclination.toFixed(2)}°
          </div>
          <div className="text-xs text-muted-foreground">
            {CLASS_LABEL[analysis.orbitClass]}
            {analysis.sunSynchronous && ` · ${hhmm(analysis.ltan + 12)} descending`}
          </div>
          <div className="text-[11px] text-muted-foreground">Generated TLE · epoch at insertion</div>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-md bg-black/40 px-2 py-1.5 font-mono text-[9.5px] leading-snug text-slate-400">
        <div className="truncate">{l1}</div>
        <div className="truncate">{l2}</div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground transition-colors group-hover:text-violet-300">
        <FileCode2 className="size-3" aria-hidden /> Open TLE →
      </div>
    </button>
  )
}
