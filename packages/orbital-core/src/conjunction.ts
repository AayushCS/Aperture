/**
 * Post-insertion conjunction screen.
 *
 * Flies the payload on its target circular orbit (two-body + J2 nodal drift)
 * from orbit insertion and propagates catalogued objects with SGP4, looking
 * for the closest approach. Miss-distance limits follow the spherical
 * separations in FAA 14 CFR 450.169: 200 km for habitable stations, 25 km for
 * other objects. This is a simplified screen — it ignores the ascent, the
 * launch time spread inside the window and element-set uncertainty.
 */
import { json2satrec, sgp4, type OMMJsonObject, type SatRec } from 'satellite.js'
import { EARTH_RADIUS_KM, MU_EARTH, SECONDS_PER_DAY } from './constants'
import { circularVelocity, meanMotion, nodalPrecession, semiMajorAxis } from './orbit'
import type { PassBranch } from './types'
import { clamp, degToRad } from './math'
import { parseGpRecord } from './traffic'

export const SCREEN_DISTANCE_KM = { habitable: 200, other: 25 } as const

export const SCREEN_DEFAULTS = { durationSec: 3 * 3600, stepSec: 10, altitudeBandKm: 50 } as const

/** CelesTrak names ISS modules "ISS (…)" and Tiangong modules "CSS (…)" */
const HABITABLE_NAME = /^(ISS|CSS) \(/

export interface ScreeningObject {
  name: string
  noradId: number
  habitable: boolean
  thresholdKm: number
  satrec: SatRec
  epochMs: number
  /** Upper bound on the object's speed (km/s), at perigee */
  maxSpeed: number
}

export interface ClosestApproach {
  name: string
  noradId: number
  distanceKm: number
  time: Date
  thresholdKm: number
}

export interface ConjunctionScreen {
  blocked: boolean
  /** e.g. "collision risk: 12.3 km from STARLINK-1234" */
  reason?: string
  /** Closest approach to any screened object (the violating one when blocked) */
  closest?: ClosestApproach
  /** Objects screened */
  screened: number
}

/** The parts of a launch window the screen needs */
export interface ScreenedWindow {
  raan: number
  branch: PassBranch
  insertion: { time: Date; latitude: number }
}

/** Objects whose perigee–apogee range overlaps altitude ± band, ready for SGP4 */
export function prepareScreeningObjects(
  records: readonly unknown[],
  altitudeKm: number,
  bandKm: number = SCREEN_DEFAULTS.altitudeBandKm
): ScreeningObject[] {
  const out: ScreeningObject[] = []
  for (const raw of records) {
    const o = parseGpRecord(raw)
    if (!o || o.perigee > altitudeKm + bandKm || o.apogee < altitudeKm - bandKm) continue
    let satrec: SatRec
    try {
      satrec = json2satrec(raw as OMMJsonObject)
    } catch {
      continue
    }
    if (satrec.error) continue
    const a = o.meanAltitude + EARTH_RADIUS_KM
    const e = clamp((o.apogee - o.perigee) / (2 * a), 0, 0.99)
    const habitable = HABITABLE_NAME.test(o.name)
    out.push({
      name: o.name,
      noradId: o.noradId,
      habitable,
      thresholdKm: habitable ? SCREEN_DISTANCE_KM.habitable : SCREEN_DISTANCE_KM.other,
      satrec,
      epochMs: (satrec.jdsatepoch - 2440587.5) * 86_400_000,
      maxSpeed: Math.sqrt((MU_EARTH * (1 + e)) / (a * (1 - e))),
    })
  }
  return out
}

type Vec = [number, number, number]

/** Payload state on its circular target orbit, `s` seconds after insertion */
function payloadState(
  a: number,
  n: number,
  inc: number,
  raan0: number,
  raanRate: number,
  u0: number,
  s: number
): { r: Vec; v: Vec } {
  const u = u0 + n * s
  const raan = raan0 + raanRate * s
  const [cu, su, cO, sO, ci, si] = [Math.cos(u), Math.sin(u), Math.cos(raan), Math.sin(raan), Math.cos(inc), Math.sin(inc)]
  const v = a * n
  return {
    r: [a * (cO * cu - sO * su * ci), a * (sO * cu + cO * su * ci), a * su * si],
    v: [v * (-cO * su - sO * cu * ci), v * (-sO * su + cO * cu * ci), v * cu * si],
  }
}

/**
 * Screen one launch window: closest approach between the payload (from insertion)
 * and each object, sampled every `stepSec` for `durationSec`.
 *
 * Steps are skipped only where the objects provably cannot come closer than the
 * relevant limit (distance shrinks no faster than the sum of their speeds), and
 * each candidate approach is refined to the linear time of closest approach
 * within ±1 step, so a fast crossing between samples is not missed.
 */
export function screenWindow(
  objects: readonly ScreeningObject[],
  orbit: { altitude: number; inclination: number },
  window: ScreenedWindow,
  options: { durationSec?: number; stepSec?: number } = {}
): ConjunctionScreen {
  const duration = options.durationSec ?? SCREEN_DEFAULTS.durationSec
  const step = options.stepSec ?? SCREEN_DEFAULTS.stepSec
  const steps = Math.floor(duration / step)

  const a = semiMajorAxis(orbit.altitude)
  const n = meanMotion(orbit.altitude)
  const inc = degToRad(orbit.inclination)
  const raanRate = degToRad(nodalPrecession(orbit.altitude, orbit.inclination)) / SECONDS_PER_DAY
  const sinU = clamp(Math.sin(degToRad(window.insertion.latitude)) / Math.sin(inc), -1, 1)
  const u0 = window.branch === 'ascending' ? Math.asin(sinU) : Math.PI - Math.asin(sinU)
  const raan0 = degToRad(window.raan)
  const t0 = window.insertion.time.getTime()
  const state = (s: number) => payloadState(a, n, inc, raan0, raanRate, u0, s)
  const grid = Array.from({ length: steps + 1 }, (_, k) => state(k * step))
  const vPayload = circularVelocity(orbit.altitude)

  let closest: ClosestApproach | undefined
  let violation: ClosestApproach | undefined

  for (const obj of objects) {
    // 5% margin: SGP4 speeds are not strictly bounded by the two-body perigee speed
    const vRel = (vPayload + obj.maxSpeed) * 1.05
    const minutesAt = (s: number) => (t0 + s * 1000 - obj.epochMs) / 60_000
    let best = Infinity
    let bestS = 0

    for (let k = 0; k <= steps; ) {
      const s = k * step
      const pv = sgp4(obj.satrec, minutesAt(s))
      if (!pv) break // decayed or diverged — no usable positions
      const p = grid[k]!
      const dr: Vec = [pv.position.x - p.r[0], pv.position.y - p.r[1], pv.position.z - p.r[2]]
      const d = Math.hypot(dr[0], dr[1], dr[2])
      if (d < best) [best, bestS] = [d, s]

      // Distances that still matter: below this object's limit, or a new overall/own minimum
      const bound = () => Math.max(Math.min(closest?.distanceKm ?? Infinity, best), obj.thresholdKm)
      if (d < bound() + vRel * step) {
        // Linear time of closest approach within ±1 step
        const dv: Vec = [pv.velocity.x - p.v[0], pv.velocity.y - p.v[1], pv.velocity.z - p.v[2]]
        const vv = dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2
        const tau = vv > 0 ? clamp(-(dr[0] * dv[0] + dr[1] * dv[1] + dr[2] * dv[2]) / vv, -step, step) : 0
        const sc = clamp(s + tau, 0, duration)
        if (sc !== s) {
          const pc = sgp4(obj.satrec, minutesAt(sc))
          if (pc) {
            const q = state(sc).r
            const dc = Math.hypot(pc.position.x - q[0], pc.position.y - q[1], pc.position.z - q[2])
            if (dc < best) [best, bestS] = [dc, sc]
          }
        }
      }

      // Nothing within the next (d − bound) / vRel seconds can come closer than `bound`
      k += Math.max(1, Math.floor((d - bound()) / (vRel * step)))
    }

    if (best === Infinity) continue
    const approach: ClosestApproach = {
      name: obj.name,
      noradId: obj.noradId,
      distanceKm: best,
      time: new Date(t0 + bestS * 1000),
      thresholdKm: obj.thresholdKm,
    }
    if (!closest || best < closest.distanceKm) closest = approach
    if (best < obj.thresholdKm && (!violation || best < violation.distanceKm)) violation = approach
  }

  const reported = violation ?? closest
  return {
    blocked: violation !== undefined,
    reason: violation ? `collision risk: ${violation.distanceKm.toFixed(1)} km from ${violation.name}` : undefined,
    closest: reported,
    screened: objects.length,
  }
}
