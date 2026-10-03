/**
 * Mathematical utilities for orbital calculations
 */

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Normalize angle to 0-360 degrees
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360
  if (normalized < 0) {
    normalized += 360
  }
  return normalized
}

/**
 * Calculate distance between two geographic points (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = degToRad(lat2 - lat1)
  const dLon = degToRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Calculate mean anomaly from time
 */
export function meanAnomalyFromTime(
  meanMotion: number, // revs per day
  epoch: Date,
  time: Date
): number {
  const deltaTime = (time.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24) // days
  const deltaRevs = meanMotion * deltaTime
  return normalizeAngle(deltaRevs * 360)
}

/**
 * Solve Kepler's equation for eccentric anomaly (using Newton's method)
 */
export function solveKepler(
  meanAnomaly: number,
  eccentricity: number,
  tolerance = 1e-12,
  maxIterations = 50
): number {
  let E = meanAnomaly // Initial guess
  let deltaE = 1
  let iterations = 0
  
  meanAnomaly = degToRad(meanAnomaly)
  
  while (Math.abs(deltaE) > tolerance && iterations < maxIterations) {
    deltaE = (meanAnomaly - (E - eccentricity * Math.sin(E))) /
      (1 - eccentricity * Math.cos(E))
    E += deltaE
    iterations++
  }
  
  return radToDeg(E)
}

/**
 * Convert Keplerian orbital elements to Cartesian position/velocity
 */
export function keplerianToCartesian(
  semiMajorAxis: number,
  eccentricity: number,
  inclination: number,
  raan: number,
  argOfPerigee: number,
  trueAnomaly: number
): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  // Convert to radians
  inclination = degToRad(inclination)
  raan = degToRad(raan)
  argOfPerigee = degToRad(argOfPerigee)
  trueAnomaly = degToRad(trueAnomaly)
  
  // Calculate distance
  const r = semiMajorAxis * (1 - eccentricity * eccentricity) /
    (1 + eccentricity * Math.cos(trueAnomaly))
  
  // Position in orbital plane
  const xOrbital = r * Math.cos(trueAnomaly)
  const yOrbital = r * Math.sin(trueAnomaly)
  
  // Velocity in orbital plane
  const mu = 398600.4418 // Earth's gravitational parameter (km^3/s^2)
  const h = Math.sqrt(mu * semiMajorAxis * (1 - eccentricity * eccentricity))
  const vxOrbital = -mu / h * Math.sin(trueAnomaly)
  const vyOrbital = mu / h * (eccentricity + Math.cos(trueAnomaly))
  
  // Rotation matrices
  const cosRaan = Math.cos(raan)
  const sinRaan = Math.sin(raan)
  const cosInc = Math.cos(inclination)
  const sinInc = Math.sin(inclination)
  const cosArg = Math.cos(argOfPerigee)
  const sinArg = Math.sin(argOfPerigee)
  
  // Rotate to equatorial coordinates
  const x = xOrbital * (cosArg * cosRaan - sinArg * cosInc * sinRaan) -
    yOrbital * (sinArg * cosRaan + cosArg * cosInc * sinRaan)
  const y = xOrbital * (cosArg * sinRaan + sinArg * cosInc * cosRaan) +
    yOrbital * (cosArg * cosInc * cosRaan - sinArg * sinRaan)
  const z = xOrbital * (sinArg * sinInc) + yOrbital * (cosArg * sinInc)
  
  const vx = vxOrbital * (cosArg * cosRaan - sinArg * cosInc * sinRaan) -
    vyOrbital * (sinArg * cosRaan + cosArg * cosInc * sinRaan)
  const vy = vxOrbital * (cosArg * sinRaan + sinArg * cosInc * cosRaan) +
    vyOrbital * (cosArg * cosInc * cosRaan - sinArg * sinRaan)
  const vz = vxOrbital * (sinArg * sinInc) + vyOrbital * (cosArg * sinInc)
  
  return { x, y, z, vx, vy, vz }
}