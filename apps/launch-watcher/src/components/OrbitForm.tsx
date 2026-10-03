import type { ReactNode } from 'react'
import { ORBIT_ALTITUDE, ORBIT_PLANE, maxApogeeAltitude, normalizeAngle, type MissionAnalysis, type OrbitalElements } from '@aperture/orbital-core'
import { SITE, type PlaneAnchor } from '@/hooks/useMissionPlan'
import { ORBIT_LIMITS, ssoInclination, useMissionStore, type OrbitFamily } from '@/store/mission'
import { Field, SliderField, inputClass } from '@/components/ui/Form'
import { hhmm } from '@/lib/orbitStats'
import { SEARCH_LIMIT_DAYS, searchDateLimits } from '@/lib/searchRange'
import { fmt } from '@/lib/format'
import { cn } from '@/utils/cn'

const deg = (v: number) => `${Number(v.toFixed(1))}°`
const kmRange = (f: OrbitFamily) => `perigee ${ORBIT_ALTITUDE[f].min}–${ORBIT_ALTITUDE[f].max.toLocaleString('en-US')} km`
// SSO inclination is computed; its span follows from the allowed perigee / apogee range
const SSO_INC_RANGE = [
  ssoInclination(ORBIT_ALTITUDE.SSO.min, ORBIT_ALTITUDE.SSO.min),
  ssoInclination(ORBIT_ALTITUDE.SSO.max, maxApogeeAltitude('SSO', ORBIT_ALTITUDE.SSO.max)),
] as const

export const FAMILY_INFO: Record<OrbitFamily, { label: string; blurb: string; color: string }> = {
  LEO: { label: 'LEO', blurb: `Low Earth orbit · ${deg(ORBIT_LIMITS.LEO.minInc)}–${deg(ORBIT_LIMITS.LEO.maxInc)} · ${kmRange('LEO')}`, color: '#38bdf8' },
  POLAR: { label: 'Polar', blurb: `Near-polar · ${deg(ORBIT_LIMITS.POLAR.minInc)}–${deg(ORBIT_LIMITS.POLAR.maxInc)} · ${kmRange('POLAR')}`, color: '#2dd4bf' },
  SSO: { label: 'Sun-sync', blurb: `Sun-locked plane · ${deg(SSO_INC_RANGE[0])}–${deg(SSO_INC_RANGE[1])}, set automatically · ${kmRange('SSO')}`, color: '#a78bfa' },
}

/** Compass direction of travel for an Earth-relative flight azimuth (the site's corridor spans east to south) */
function headingWord(azimuth: number): string {
  const words = ['northbound', 'northeastbound', 'eastbound', 'southeastbound', 'southbound', 'southwestbound', 'westbound', 'northwestbound']
  return words[Math.round(normalizeAngle(azimuth) / 45) % 8]!
}

/** Orbit-family cards (LEO / Polar / SSO) */
export function FamilyPicker({ className }: { className?: string }) {
  const type = useMissionStore((s) => s.mission.orbitType)
  const applyOrbitPreset = useMissionStore((s) => s.applyOrbitPreset)
  return (
    <div role="radiogroup" aria-label="Orbit type" className={cn('grid grid-cols-3 gap-2', className)}>
      {(Object.keys(FAMILY_INFO) as OrbitFamily[]).map((f) => {
        const info = FAMILY_INFO[f]
        const active = f === type
        return (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => applyOrbitPreset(f)}
            className={cn(
              'group relative overflow-hidden rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5',
              active ? 'border-transparent bg-white/[0.06] shadow-lg' : 'border-white/5 bg-black/20 hover:bg-white/[0.04]'
            )}
            style={active ? { boxShadow: `0 0 0 1px ${info.color}88, 0 12px 30px -12px ${info.color}55` } : undefined}
          >
            <FamilyGlyph family={f} active={active} />
            <div className="mt-2 text-sm font-semibold" style={{ color: active ? info.color : undefined }}>
              {info.label}
            </div>
            <div className="mt-0.5 hidden text-[10.5px] leading-snug text-muted-foreground sm:block">{info.blurb}</div>
          </button>
        )
      })}
    </div>
  )
}

/** Tiny animated orbit icon per family */
function FamilyGlyph({ family, active }: { family: OrbitFamily; active: boolean }) {
  const { color } = FAMILY_INFO[family]
  const tilt = family === 'LEO' ? -28 : family === 'POLAR' ? -88 : -80
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-hidden>
      <circle cx={24} cy={16} r={8} fill="#1d4ed8" opacity={0.7} />
      <g transform={`rotate(${tilt} 24 16)`}>
        <ellipse cx={24} cy={16} rx={18} ry={5} fill="none" stroke={color} strokeWidth={1.4} opacity={active ? 1 : 0.5} />
        {active ? (
          <circle r={2} fill="#f8fafc">
            <animateMotion dur="3s" repeatCount="indefinite" path="M42,16 A18,5 0 1,1 6,16 A18,5 0 1,1 42,16" />
          </circle>
        ) : (
          <circle cx={42} cy={16} r={2} fill="#f8fafc" opacity={0.6} />
        )}
      </g>
    </svg>
  )
}

function ReadOnlyField({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <div className="tabular flex min-h-9 items-center rounded-md border border-input bg-background/40 px-3 py-1.5 text-sm">{value}</div>
    </Field>
  )
}

/** Plane date / search start, bound to mission.startDate; empty = today (follows the clock) */
function PlaneDateField({ localDate }: { localDate?: string }) {
  const startDate = useMissionStore((s) => s.mission.startDate)
  const update = useMissionStore((s) => s.update)
  const today = !startDate
  const limits = searchDateLimits(new Date(), SITE.timeZone!)
  return (
    <Field
      label="Plane date / search from"
      htmlFor="plane-date"
      hint={`${today ? 'Today — follows the clock (Canso date)' : 'Plane set on this Canso date · search starts 00:00 UTC'} · up to ${SEARCH_LIMIT_DAYS} days ahead`}
    >
      <div className="flex gap-2">
        <input
          id="plane-date"
          type="date"
          className={inputClass}
          min={limits.today}
          max={limits.last}
          value={startDate || localDate || limits.today}
          onChange={(e) => update({ startDate: e.target.value })}
        />
        <button
          type="button"
          disabled={today}
          onClick={() => update({ startDate: '' })}
          className="h-9 shrink-0 rounded-md border border-input px-3 text-xs font-medium text-primary hover:bg-white/[0.04] disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
        >
          Today
        </button>
      </div>
    </Field>
  )
}

const planeDate = (localDate: string) =>
  new Date(`${localDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Orbit inputs for the chosen family. `orbit` is the designed target; `plane` anchors LEO / polar. */
export default function OrbitForm({ analysis, orbit, plane }: { analysis: MissionAnalysis; orbit: OrbitalElements; plane?: PlaneAnchor }) {
  const mission = useMissionStore((s) => s.mission)
  const update = useMissionStore((s) => s.update)
  const family = mission.orbitType
  const alt = ORBIT_ALTITUDE[family]
  const apogeeMax = maxApogeeAltitude(family, mission.perigee)
  const circular = mission.apogee === mission.perigee
  const allowed = analysis.opportunities.find((o) => o.withinCorridor)

  return (
    <div className="space-y-6">
      <FamilyPicker />
      <div className="grid gap-5 sm:grid-cols-2">
        <SliderField
          id="perigee"
          label="Perigee altitude"
          unit="km"
          min={alt.min}
          max={alt.max}
          step={10}
          value={mission.perigee}
          onChange={(perigee) => update({ perigee })}
          hint={`${alt.min}–${alt.max.toLocaleString('en-US')} km · default ${alt.defaultKm} km`}
        />
        <SliderField
          id="apogee"
          label="Apogee altitude"
          unit="km"
          min={mission.perigee}
          max={apogeeMax}
          step={10}
          value={mission.apogee}
          onChange={(apogee) => update({ apogee })}
          hint={
            circular
              ? `Equal to perigee: circular · up to ${apogeeMax.toLocaleString('en-US')} km`
              : `e = ${orbit.eccentricity.toFixed(4)} · up to ${apogeeMax.toLocaleString('en-US')} km`
          }
        />
        {family === 'SSO' ? (
          <>
            <ReadOnlyField
              label="Inclination"
              value={fmt.deg(mission.inclination, 2)}
              hint={`Computed from a = ${orbit.semiMajorAxis.toFixed(1)} km, e = ${orbit.eccentricity.toFixed(4)} so the plane turns with the Sun`}
            />
            <div className="space-y-5">
              <ReadOnlyField
                label="Equator crossing"
                value={`Southbound ${hhmm(ORBIT_PLANE.ssoDescendingNodeHours)} mean local solar time`}
                hint={`Fixed · northbound ${hhmm(ORBIT_PLANE.ssoDescendingNodeHours + 12)} · Ω ${fmt.deg(orbit.raan, 2)} at search start`}
              />
              <PlaneDateField />
            </div>
          </>
        ) : (
          <>
            <SliderField
              id="inclination"
              label="Inclination"
              unit="°"
              min={ORBIT_LIMITS[family].minInc}
              max={ORBIT_LIMITS[family].maxInc}
              step={0.1}
              value={mission.inclination}
              onChange={(inclination) => update({ inclination })}
              format={(v) => v.toFixed(1)}
              hint={
                family === 'LEO'
                  ? `${deg(ORBIT_LIMITS.LEO.minInc)}–${deg(ORBIT_LIMITS.LEO.maxInc)} · 45.3° is Canso's latitude, flown due east`
                  : `${deg(ORBIT_LIMITS.POLAR.minInc)}–${deg(ORBIT_LIMITS.POLAR.maxInc)} · 90° passes over both poles`
              }
            />
<div className="space-y-5">
              <ReadOnlyField
                label="Plane orientation (RAAN)"
                value={
                  plane
                    ? `Ω = ${fmt.deg(orbit.raan, 2)} on ${planeDate(plane.localDate)} `
                    : '—'
                }
                hint={
                  plane
                    ? `${ORBIT_PLANE.insertionLocalTime[family]} ${fmt.zoneName(plane.insertionTime, SITE.timeZone!)} at Canso, liftoff one ascent earlier · then J2 drift ${analysis.nodalPrecessionDegDay.toFixed(3)}°/day`
                    : undefined
                }
              />
              <PlaneDateField localDate={plane?.localDate} />
            </div>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {allowed
          ? `Perigee is placed where the ${headingWord(allowed.azimuth)} ascent from Canso reaches orbit, so every window injects at ${Math.round(mission.perigee)} km.`
          : 'No pass of this plane is reachable inside the over-ocean corridor.'}
      </p>
    </div>
  )
}
