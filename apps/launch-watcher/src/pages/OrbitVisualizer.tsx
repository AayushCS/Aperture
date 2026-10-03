import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Globe2, Orbit, Satellite } from 'lucide-react'
import { useMissionPlan } from '@/hooks/useMissionPlan'
import { useMissionStore } from '@/store/mission'
import MissionHeading from '@/components/MissionHeading'
import OrbitGlobe from '@/components/OrbitGlobe'
import IssueList from '@/components/IssueList'
import EllipseDiagram from '@/components/EllipseDiagram'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Badge'
import { Button, buttonVariants } from '@/components/ui/Button'
import { CLASS_COLOR, CLASS_LABEL, hhmm } from '@/lib/orbitStats'
import { fmt } from '@/lib/format'

export default function OrbitVisualizer() {
  const plan = useMissionPlan()
  const inspect = useMissionStore((s) => s.inspect)
  const { mission, analysis, focus, site, orbit, tle } = plan
  const [exaggerate, setExaggerate] = useState(true)
  const color = CLASS_COLOR[analysis.orbitClass]

  return (
    <div className="space-y-6">
      <MissionHeading plan={plan} eyebrow="Orbit" title={mission.name || 'Untitled mission'} />

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 animate-in fade-in-0 zoom-in-[0.98] duration-500">
          <CardHeader
            icon={<Globe2 />}
            title="One orbit, seen from the ground"
            description={focus ? `Liftoff ${fmt.utcDateTime(focus.optimal)} · simulated from orbit insertion` : 'No window to visualise'}
          />
          <CardBody>
            {focus ? (
              <OrbitGlobe site={site} window={focus} name={tle.name ?? 'Mission'} color={color} />
            ) : (
              <div className="space-y-4">
                <IssueList issues={analysis.issues} />
                <Link to="/planner" className={buttonVariants()}>
                  Adjust mission <ArrowRight aria-hidden />
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="animate-in fade-in-0 slide-in-from-right-4 duration-500">
          <CardHeader
            icon={<Orbit />}
            title="The orbit in its plane"
            description={`${CLASS_LABEL[analysis.orbitClass]} · ${mission.orbitType} target`}
            action={
              orbit.eccentricity < 0.05 && (
                <Button size="sm" variant="ghost" onClick={() => setExaggerate((v) => !v)} aria-pressed={exaggerate}>
                  {exaggerate ? 'True shape' : 'Exaggerate'}
                </Button>
              )
            }
          />
          <CardBody className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-black/30 px-6 py-2">
              <EllipseDiagram orbit={orbit} color={color} exaggerate={exaggerate && orbit.eccentricity < 0.05 ? 10 : 1} insertionTrueAnomaly={focus?.insertion.trueAnomaly} />
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Perigee" value={fmt.km(analysis.perigeeAltitudeKm)} hint={`${analysis.perigeeVelocityKmS.toFixed(2)} km/s`} />
              <Stat label="Apogee" value={fmt.km(analysis.apogeeAltitudeKm)} hint={`${analysis.apogeeVelocityKmS.toFixed(2)} km/s`} />
              <Stat label="Inclination" value={fmt.deg(orbit.inclination, 2)} hint={orbit.inclination > 90 ? 'Retrograde' : 'Prograde'} />
              <Stat label="Period" value={`${analysis.periodMinutes.toFixed(1)} min`} hint={`${analysis.revsPerDay.toFixed(2)} rev/day`} />
              <Stat label="Node" value={analysis.sunSynchronous ? `LTAN ${hhmm(analysis.ltan)}` : `${analysis.nodalPrecessionDegDay.toFixed(2)}°/d`} hint={analysis.sunSynchronous ? 'Locked to the Sun' : 'J2 drift'} />
              {focus ? (
                <Stat label="Insertion" value={fmt.km(focus.insertion.altitude)} hint={`ν ${fmt.angle(focus.insertion.trueAnomaly, 1)} (0° = perigee)`} />
              ) : (
                <Stat label="Eccentricity" value={orbit.eccentricity.toFixed(5)} />
              )}
            </dl>
            <Button variant="secondary" className="w-full" onClick={() => inspect('mission')}>
              <Satellite aria-hidden /> Open TLE
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}