import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy, Crosshair, Globe2, Satellite } from 'lucide-react'
import { tleToElements, tleToText } from '@aperture/orbital-core'
import { useMissionStore } from '@/store/mission'
import { CLASS_COLOR, catalogById } from '@/data/catalog'
import { parseMissionTle } from '@/hooks/useMissionPlan'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Badge'
import TleView from '@/components/TleView'
import EllipseDiagram from '@/components/EllipseDiagram'
import { CLASS_LABEL, ageLabel, hhmm, summarizeOrbit } from '@/lib/orbitStats'
import { fmt } from '@/lib/format'

/** Global satellite inspector: the mission orbit or any catalog object */
export default function SatelliteInspector() {
  const inspecting = useMissionStore((s) => s.inspecting)
  const inspect = useMissionStore((s) => s.inspect)
  const setTle = useMissionStore((s) => s.setTle)
  const update = useMissionStore((s) => s.update)
  const missionTle = useMissionStore((s) => s.mission.tle)
  const navigate = useNavigate()

  const sat = inspecting && inspecting !== 'mission' ? catalogById(inspecting) : undefined
  const isMission = inspecting === 'mission'
  const open = isMission || !!sat

  const mTle = parseMissionTle(missionTle)
  const elements = sat ? sat.elements : tleToElements(mTle)
  const tle = sat ? sat.tle : mTle
  const lines = (sat ? sat.lines : tleToText(mTle).split('\n').slice(-2)) as [string, string]
  const s = summarizeOrbit(elements)
  const color = sat ? sat.color : CLASS_COLOR[s.orbitClass]
  const name = sat?.name ?? tle.name ?? 'Mission'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tleToText(tle))
      toast.success('TLE copied')
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => inspect(null)}
      icon={<Satellite />}
      title={
        <span className="flex items-center gap-2">
          {name}
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color, backgroundColor: `${color}22` }}>
            {s.orbitClass}
          </span>
        </span>
      }
      description={sat ? `NORAD ${sat.noradId} · ${sat.operator} · launched ${sat.launchDate}` : `Hypothetical mission orbit · catalog ${tle.catalogNumber}`}
    >
      <div className="space-y-5">
        {sat && <p className="text-sm text-muted-foreground">{sat.mission}</p>}

        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Perigee" value={fmt.km(s.perigee)} hint={`${s.vPerigee.toFixed(2)} km/s`} />
            <Stat label="Apogee" value={fmt.km(s.apogee)} hint={`${s.vApogee.toFixed(2)} km/s`} />
            <Stat label="Inclination" value={fmt.deg(elements.inclination, 2)} hint={elements.inclination > 90 ? 'Retrograde' : 'Prograde'} />
            <Stat label="Period" value={s.periodMin > 600 ? `${(s.periodMin / 60).toFixed(2)} h` : `${s.periodMin.toFixed(1)} min`} hint={`${s.revsPerDay.toFixed(2)} rev/day`} />
            <Stat label="Node drift" value={`${s.raanRate.toFixed(3)}°/d`} hint={s.orbitClass === 'SSO' ? `LTAN ${hhmm(s.ltan)}` : 'J2 secular'} />
            <Stat label="TLE epoch" value={fmt.utcDate(elements.epoch)} hint={ageLabel(s.ageDays)} />
          </dl>
          <div className="rounded-xl border border-white/5 bg-black/30 p-2">
            <EllipseDiagram orbit={elements} color={color} size={200} exaggerate={elements.eccentricity < 0.05 ? 10 : 1} />
            <p className="text-center text-[10px] text-muted-foreground">{CLASS_LABEL[s.orbitClass]}</p>
          </div>
        </div>

        <TleView name={name} lines={lines} />

        <div className="flex flex-wrap gap-2">
          {sat && (
            <Button
              onClick={() => {
                setTle(`${sat.name}\n${sat.lines[0]}\n${sat.lines[1]}`)
                update({ name: `Into ${sat.name}'s plane` })
                inspect(null)
                toast.success(`Mission now targets ${sat.name}'s orbit`)
              }}
            >
              <Crosshair aria-hidden /> Target this orbit
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              inspect(null)
              navigate('/orbit')
            }}
          >
            <Globe2 aria-hidden /> Show on globe
          </Button>
          <Button variant="outline" onClick={copy}>
            <Copy aria-hidden /> Copy TLE
          </Button>
        </div>
        {sat && s.ageDays > 14 && (
          <p className="text-[11px] text-watch">
            This element set is {Math.round(s.ageDays)} days old. Positions drift as drag and perturbations accumulate; fetch a fresh TLE from CelesTrak for real planning.
          </p>
        )}
      </div>
    </Dialog>
  )
}