import { Link } from 'react-router-dom'
import { ArrowRight, Globe2, Info } from 'lucide-react'
import type { OrbitType } from '@aperture/orbital-core'
import { useMissionPlan } from '@/hooks/useMissionPlan'
import MissionHeading from '@/components/MissionHeading'
import OrbitGlobe from '@/components/OrbitGlobe'
import IssueList from '@/components/IssueList'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Badge'
import { buttonVariants } from '@/components/ui/Button'
import { fmt } from '@/lib/format'

const ORBIT_NOTES: Record<OrbitType, { uses: string; physics: string }> = {
  LEO: {
    uses: 'Crew and cargo to space stations, broadband constellations, technology demonstrations.',
    physics:
      'The orbital plane is fixed in inertial space (apart from slow J2 drift), so Earth rotates the launch site under it once per day — that crossing is the launch window.',
  },
  POLAR: {
    uses: 'Weather, reconnaissance and mapping satellites that must overfly the entire globe.',
    physics:
      'Near 90° the plane barely precesses. The site passes under it twice a day — once heading north, once south — giving two daily opportunities.',
  },
  SSO: {
    uses: 'Earth observation and imaging that needs consistent lighting at every pass.',
    physics:
      "A slightly retrograde inclination makes Earth's equatorial bulge rotate the plane 0.9856°/day — matching the Sun — so the window occurs at the same local solar time daily.",
  },
}

export default function OrbitVisualizer() {
  const plan = useMissionPlan()
  const { mission, analysis, focus, site } = plan
  const notes = ORBIT_NOTES[mission.orbitType]

  return (
    <div className="space-y-6">
      <MissionHeading plan={plan} eyebrow="Orbit visualiser" title={mission.name || 'Untitled mission'} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Globe2 />}
            title="Ascent and first orbits"
            description={focus ? `Liftoff ${fmt.utcDateTime(focus.optimal)} · simulated from orbit insertion` : 'No window to visualise'}
          />
          <CardBody>
            {focus ? (
              <OrbitGlobe site={site} window={focus} altitude={mission.altitude} inclination={mission.inclination} />
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

        <div className="space-y-6">
          <Card>
            <CardHeader title="Orbital elements" description="Circular orbit, two-body + J2 secular perturbation" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Altitude" value={fmt.km(mission.altitude)} />
                <Stat label="Inclination" value={fmt.deg(mission.inclination, 2)} hint={mission.inclination > 90 ? 'Retrograde' : 'Prograde'} />
                <Stat label="Period" value={`${analysis.periodMinutes.toFixed(1)} min`} />
                <Stat label="Velocity" value={`${analysis.velocityKmS.toFixed(2)} km/s`} />
                <Stat label="Node drift" value={`${analysis.nodalPrecessionDegDay.toFixed(3)}°/d`} />
                <Stat label="SSO inclination" value={fmt.deg(analysis.sunSynchronousInclination, 2)} hint="At this altitude" />
                {focus && <Stat label="RAAN at insertion" value={fmt.deg(focus.raan, 2)} />}
                {focus && <Stat label="Flight azimuth" value={fmt.deg(focus.azimuth)} hint={`${focus.branch} pass`} />}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Info />} title={`About ${mission.orbitType === 'SSO' ? 'sun-synchronous' : mission.orbitType === 'POLAR' ? 'polar' : 'low Earth'} orbits`} />
            <CardBody className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>{notes.physics}</p>
              <p>
                <span className="font-medium text-foreground">Typical uses: </span>
                {notes.uses}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
