import { toast } from 'sonner'
import { Copy, Download, FileCode2 } from 'lucide-react'
import { formatTle, tleToText } from '@aperture/orbital-core'
import { useMissionStore } from '@/store/mission'
import { useMissionPlan, type MissionPlan } from '@/hooks/useMissionPlan'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Badge'
import TleView from '@/components/TleView'
import EllipseDiagram from '@/components/EllipseDiagram'
import { CLASS_COLOR, CLASS_LABEL, hhmm } from '@/lib/orbitStats'
import { fmt } from '@/lib/format'

async function copyTle(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('TLE copied')
  } catch {
    toast.error('Clipboard unavailable')
  }
}

function downloadTle(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'mission'}.tle`
  a.click()
  URL.revokeObjectURL(url)
}

/** The generated TLE with copy / download, plus where it comes from */
export function GeneratedTle({ plan }: { plan: MissionPlan }) {
  const { tle, focus } = plan
  const text = tleToText(tle)
  return (
    <div className="space-y-3">
      <TleView name={tle.name} lines={formatTle(tle)} />
      <p className="text-[11px] text-muted-foreground">
        {focus
          ? `Orbit as flown for the ${fmt.utcDateTime(focus.optimal)} window from ${plan.site.name}. Epoch = insertion (${fmt.utcTime(focus.insertion.time)}), so the ground track starts over the Canso ascent.`
          : 'No window in range — showing the target orbit at the search start.'}{' '}
        Hypothetical object; catalog 99901 is unassigned.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => copyTle(text)}>
          <Copy aria-hidden /> Copy TLE
        </Button>
        <Button size="sm" variant="outline" onClick={() => downloadTle(text, tle.name ?? 'mission')}>
          <Download aria-hidden /> Download .tle
        </Button>
      </div>
    </div>
  )
}

/** Dialog opened from the mission widget and the globe */
export default function TleDialog() {
  const inspecting = useMissionStore((s) => s.inspecting)
  const inspect = useMissionStore((s) => s.inspect)
  const plan = useMissionPlan()
  const { analysis, focus, orbit } = plan
  const el = focus?.orbit ?? orbit
  const color = CLASS_COLOR[analysis.orbitClass]

  return (
    <Dialog
      open={inspecting === 'mission'}
      onClose={() => inspect(null)}
      icon={<FileCode2 />}
      title={
        <span className="flex items-center gap-2">
          {plan.tle.name}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color, backgroundColor: `${color}22` }}>
            {plan.mission.orbitType}
          </span>
        </span>
      }
      description={`${CLASS_LABEL[analysis.orbitClass]} · generated for a launch from ${plan.site.name}`}
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Perigee" value={fmt.km(analysis.perigeeAltitudeKm)} hint={`${analysis.perigeeVelocityKmS.toFixed(2)} km/s`} />
            <Stat label="Apogee" value={fmt.km(analysis.apogeeAltitudeKm)} hint={`${analysis.apogeeVelocityKmS.toFixed(2)} km/s`} />
            <Stat label="Inclination" value={fmt.deg(el.inclination, 2)} hint={el.inclination > 90 ? 'Retrograde' : 'Prograde'} />
            <Stat label="Period" value={`${analysis.periodMinutes.toFixed(1)} min`} hint={`${analysis.revsPerDay.toFixed(2)} rev/day`} />
            <Stat label="Node" value={analysis.sunSynchronous ? `LTAN ${hhmm(analysis.ltan)}` : `${analysis.nodalPrecessionDegDay.toFixed(2)}°/d`} hint={analysis.sunSynchronous ? 'Locked to the Sun' : 'J2 drift'} />
            <Stat label="Epoch" value={fmt.utcDate(el.epoch)} hint={fmt.utcTime(el.epoch)} />
          </dl>
          <div className="rounded-xl border border-white/5 bg-black/30 p-2">
            <EllipseDiagram orbit={el} color={color} size={200} labels={false} exaggerate={el.eccentricity < 0.05 ? 10 : 1} insertionTrueAnomaly={focus?.insertion.trueAnomaly} />
          </div>
        </div>
        <GeneratedTle plan={plan} />
      </div>
    </Dialog>
  )
}