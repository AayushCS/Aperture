import { useState } from 'react'
import { ORBIT_ALTITUDE, type MissionAnalysis } from '@aperture/orbital-core'
import { ORBIT_LIMITS, useMissionStore, type OrbitFamily } from '@/store/mission'
import { SliderField } from '@/components/ui/Form'
import { hhmm } from '@/lib/orbitStats'
import { fmt } from '@/lib/format'
import { cn } from '@/utils/cn'

export const FAMILY_INFO: Record<OrbitFamily, { label: string; blurb: string; color: string }> = {
  LEO: { label: 'LEO', blurb: 'Low Earth orbit · 45°–80° · stations, constellations, tech demos', color: '#38bdf8' },
  POLAR: { label: 'Polar', blurb: 'Near 90° · overflies the whole globe every day', color: '#2dd4bf' },
  SSO: { label: 'Sun-sync', blurb: 'Plane locked to the Sun · same local time every pass', color: '#a78bfa' },
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

/** Orbit inputs for the chosen family */
export default function OrbitForm({ analysis }: { analysis: MissionAnalysis }) {
  const mission = useMissionStore((s) => s.mission)
  const update = useMissionStore((s) => s.update)
  const limits = ORBIT_LIMITS[mission.orbitType]
  const altRange = ORBIT_ALTITUDE[mission.orbitType]
  const isDefault = mission.perigee === altRange.defaultKm && mission.apogee === altRange.defaultKm
  const [advancedAlt, setAdvancedAlt] = useState(!isDefault)

  return (
    <div className="space-y-6">
      <FamilyPicker />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          {advancedAlt ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField
                id="perigee"
                label="Perigee altitude"
                unit="km"
                min={altRange.min}
                max={altRange.max}
                step={5}
                value={mission.perigee}
                onChange={(v) => update({ perigee: v, apogee: Math.max(v, mission.apogee) })}
                hint={`Lowest point — the vehicle injects here · default ${altRange.defaultKm} km`}
              />
              <SliderField
                id="apogee"
                label="Apogee altitude"
                unit="km"
                min={altRange.min}
                max={altRange.max}
                step={5}
                value={mission.apogee}
                onChange={(v) => update({ apogee: v, perigee: Math.min(v, mission.perigee) })}
                hint={mission.apogee === mission.perigee ? 'Equal to perigee → circular' : `Elliptical, e = ${((mission.apogee - mission.perigee) / (mission.apogee + mission.perigee + 2 * 6378.137)).toFixed(4)}`}
              />
            </div>
          ) : (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Altitude</span>
              <p className="text-sm">
                {mission.perigee === mission.apogee ? `${mission.perigee} km` : `${mission.perigee} × ${mission.apogee} km`}{' '}
                <span className="text-xs text-muted-foreground">{isDefault ? '(default)' : '(custom)'}</span>
              </p>
            </div>
          )}
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline"
            onClick={() => {
              if (advancedAlt) update({ perigee: altRange.defaultKm, apogee: altRange.defaultKm })
              setAdvancedAlt((v) => !v)
            }}
          >
            {advancedAlt ? 'Reset to default' : 'Advanced: change altitude'}
          </button>
        </div>
        {mission.orbitType === 'SSO' ? (
          <>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Inclination</span>
              <div className="tabular flex h-9 items-center rounded-md border border-input bg-background/40 px-3 text-sm">{fmt.deg(mission.inclination, 2)}</div>
              <p className="text-[11px] text-muted-foreground">Set automatically so the plane turns with the Sun</p>
            </div>
            <SliderField
              id="ltan"
              label="Local time of ascending node"
              unit="h"
              min={0}
              max={23.75}
              step={0.25}
              value={mission.ltan}
              onChange={(ltan) => update({ ltan })}
              hint={`Northbound ${hhmm(mission.ltan)} · southbound ${hhmm(mission.ltan + 12)} local solar time`}
            />
          </>
        ) : (
          <>
            <SliderField
              id="inclination"
              label="Inclination"
              unit="°"
              min={limits.minInc}
              max={limits.maxInc}
              step={0.1}
              value={mission.inclination}
              onChange={(inclination) => update({ inclination })}
              hint={mission.orbitType === 'LEO' ? 'Canso is at 45.3°N, the lowest reachable inclination' : '90° passes over both poles'}
            />
            <SliderField
              id="raan"
              label="Plane orientation (RAAN)"
              unit="°"
              min={0}
              max={359.5}
              step={0.5}
              value={mission.raan}
              onChange={(raan) => update({ raan })}
              hint="At the search start · moves the launch time of day"
            />
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {analysis.opportunities.some((o) => o.withinCorridor)
          ? `Perigee is placed where the ${analysis.opportunities.find((o) => o.withinCorridor)!.branch === 'descending' ? 'southbound' : 'northbound'} ascent from Canso reaches orbit, so every window injects at ${Math.round(mission.perigee)} km.`
          : 'No pass of this plane is reachable inside the over-ocean corridor.'}
      </p>
    </div>
  )
}