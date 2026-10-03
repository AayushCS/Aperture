import {
  apogeeAltitude,
  perigeeAltitude,
  raanForLtan,
  shapeFromApsides,
  sunSynchronousInclinationFor,
  type MissionAnalysis,
  type OrbitalElements,
} from '@aperture/orbital-core'
import { useMissionStore } from '@/store/mission'
import { Field, SliderField, inputClass } from '@/components/ui/Form'
import { hhmm } from '@/lib/orbitStats'
import { fmt, isoDay } from '@/lib/format'

const round = (v: number, d: number) => Number(v.toFixed(d))

/** Edit the orbit as elements; every change is written back into the TLE */
export default function ElementEditor({ orbit, analysis }: { orbit: OrbitalElements; analysis: MissionAnalysis }) {
  const setElements = useMissionStore((s) => s.setElements)
  const rp = round(perigeeAltitude(orbit), 1)
  const ra = round(apogeeAltitude(orbit), 1)
  const ssoInc = sunSynchronousInclinationFor(orbit.semiMajorAxis, orbit.eccentricity)
  const insertion = analysis.opportunities.find((o) => o.withinCorridor)

  const setApsides = (perigee: number, apogee: number) => setElements(shapeFromApsides(perigee, apogee))

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SliderField id="perigee" label="Perigee altitude" unit="km" min={150} max={2000} step={5} value={rp} onChange={(v) => setApsides(v, Math.max(v, ra))} />
      <SliderField
        id="apogee"
        label="Apogee altitude"
        unit="km"
        min={150}
        max={40000}
        step={10}
        value={ra}
        onChange={(v) => setApsides(Math.min(rp, v), v)}
        hint={`e = ${orbit.eccentricity.toFixed(5)}${orbit.eccentricity < 0.001 ? ' · near-circular' : ''}`}
      />
      <SliderField
        id="inclination"
        label="Inclination"
        unit="°"
        min={0}
        max={140}
        step={0.0001}
        value={round(orbit.inclination, 4)}
        onChange={(inclination) => setElements({ inclination })}
        hint={
          Number.isFinite(ssoInc) ? (
            <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setElements({ inclination: round(ssoInc, 4) })}>
              Make sun-synchronous ({fmt.deg(ssoInc, 2)})
            </button>
          ) : (
            'Too high for a sun-synchronous orbit'
          )
        }
      />
      <SliderField
        id="ltan"
        label="Local time of ascending node"
        unit="h"
        min={0}
        max={24}
        step={0.25}
        value={round(analysis.ltan, 2)}
        onChange={(ltan) => setElements({ raan: round(raanForLtan(ltan % 24, orbit.epoch), 4) })}
        hint={`Ascending ${hhmm(analysis.ltan)} · descending ${hhmm(analysis.ltan + 12)} local solar time${analysis.sunSynchronous ? '' : ' (drifts — not SSO)'}`}
      />
      <SliderField
        id="raan"
        label="RAAN at epoch"
        unit="°"
        min={0}
        max={359.9999}
        step={0.0001}
        value={round(orbit.raan, 4)}
        onChange={(raan) => setElements({ raan })}
        hint="Where the plane sits in space — this sets the time of day of the window"
      />
      <SliderField
        id="argp"
        label="Argument of perigee"
        unit="°"
        min={0}
        max={359.9999}
        step={0.0001}
        value={round(orbit.argOfPerigee, 4)}
        onChange={(argOfPerigee) => setElements({ argOfPerigee })}
        hint={
          insertion && orbit.eccentricity > 0.001 ? (
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => setElements({ argOfPerigee: round(insertion.insertionArgumentOfLatitude, 4) })}
            >
              Inject at perigee ({fmt.deg(insertion.insertionArgumentOfLatitude, 2)}) · now inserts at {fmt.km(insertion.insertionAltitude)}
            </button>
          ) : (
            'Irrelevant for circular orbits'
          )
        }
      />
      <Field label="TLE epoch (UTC)" htmlFor="epoch" hint="The plane is propagated from this instant with J2">
        <input
          id="epoch"
          type="date"
          className={inputClass}
          value={isoDay(orbit.epoch)}
          onChange={(e) => {
            const d = new Date(`${e.target.value}T00:00:00Z`)
            if (Number.isNaN(d.getTime())) return
            // Keep the local time of the node for sun-synchronous orbits
            setElements(analysis.sunSynchronous ? { epoch: d, raan: round(raanForLtan(analysis.ltan, d), 4) } : { epoch: d })
          }}
        />
      </Field>
    </div>
  )
}