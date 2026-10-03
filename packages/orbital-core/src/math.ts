/**
 * General-purpose math helpers used by the orbital engine.
 */

const DEG = Math.PI / 180

/** Convert degrees to radians */
export function degToRad(degrees: number): number {
  return degrees * DEG
}

/** Convert radians to degrees */
export function radToDeg(radians: number): number {
  return radians / DEG
}

/** Normalize an angle to [0, 360) degrees */
export function normalizeAngle(angle: number): number {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

/** Normalize an angle to [-180, 180) degrees */
export function wrap180(angle: number): number {
  return normalizeAngle(angle + 180) - 180
}

/** Great-circle distance between two geographic points in km (haversine, mean Earth radius) */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = degToRad(lat2 - lat1)
  const dLon = degToRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Linear interpolation */
export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Hermite smoothstep: 0 below edge0, 1 above edge1 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Mean anomaly (degrees) after propagating from epoch at a given mean motion.
 * @param meanMotion revolutions per day
 */
export function meanAnomalyFromTime(meanMotion: number, epoch: Date, time: Date): number {
  const deltaDays = (time.getTime() - epoch.getTime()) / 86_400_000
  return normalizeAngle(meanMotion * deltaDays * 360)
}

/**
 * Solve Kepler's equation M = E − e·sin(E) for the eccentric anomaly.
 * @param meanAnomaly degrees
 * @returns eccentric anomaly in degrees
 */
export function solveKepler(
  meanAnomaly: number,
  eccentricity: number,
  tolerance = 1e-12,
  maxIterations = 50
): number {
  const M = degToRad(meanAnomaly)
  let E = eccentricity < 0.8 ? M : Math.PI
  for (let i = 0; i < maxIterations; i++) {
    const delta = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E))
    E -= delta
    if (Math.abs(delta) < tolerance) break
  }
  return radToDeg(E)
}

/**
 * Convert Keplerian orbital elements to ECI Cartesian position (km) and velocity (km/s).
 * Angles in degrees.
 */
export function keplerianToCartesian(
  semiMajorAxis: number,
  eccentricity: number,
  inclination: number,
  raan: number,
  argOfPerigee: number,
  trueAnomaly: number
): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  const mu = 398600.4418
  const i = degToRad(inclination)
  const O = degToRad(raan)
  const w = degToRad(argOfPerigee)
  const nu = degToRad(trueAnomaly)

  const p = semiMajorAxis * (1 - eccentricity * eccentricity)
  const r = p / (1 + eccentricity * Math.cos(nu))

  // Perifocal frame
  const xP = r * Math.cos(nu)
  const yP = r * Math.sin(nu)
  const k = Math.sqrt(mu / p)
  const vxP = -k * Math.sin(nu)
  const vyP = k * (eccentricity + Math.cos(nu))

  const cO = Math.cos(O), sO = Math.sin(O)
  const ci = Math.cos(i), si = Math.sin(i)
  const cw = Math.cos(w), sw = Math.sin(w)

  const r11 = cO * cw - sO * sw * ci
  const r12 = -cO * sw - sO * cw * ci
  const r21 = sO * cw + cO * sw * ci
  const r22 = -sO * sw + cO * cw * ci
  const r31 = sw * si
  const r32 = cw * si

  return {
    x: r11 * xP + r12 * yP,
    y: r21 * xP + r22 * yP,
    z: r31 * xP + r32 * yP,
    vx: r11 * vxP + r12 * vyP,
    vy: r21 * vxP + r22 * vyP,
    vz: r31 * vxP + r32 * vyP,
  }
}

/** Deterministic 32-bit string hash (FNV-1a) */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic pseudo-random value in [0, 1) derived from a string seed */
export function seededRandom(seed: string): number {
  let t = hashString(seed) + 0x6d2b79f5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
