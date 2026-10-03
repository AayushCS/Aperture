/** WGS-84 equatorial radius (km) */
export const EARTH_RADIUS_KM = 6378.137

/** Earth's gravitational parameter μ (km³/s²) */
export const MU_EARTH = 398600.4418

/** Second zonal harmonic (oblateness) */
export const J2 = 1.08262668e-3

/** Earth's sidereal rotation rate (rad/s) */
export const EARTH_ROTATION_RAD_S = 7.2921159e-5

/** Rate of Greenwich sidereal time (deg/day) */
export const SIDEREAL_RATE_DEG_DAY = 360.98564736629

/** Mean apparent motion of the Sun in right ascension (deg/day) */
export const SUN_RATE_DEG_DAY = 360 / 365.2421897

export const MS_PER_DAY = 86_400_000
export const SECONDS_PER_DAY = 86_400
export const MINUTES_PER_DAY = 1_440

/**
 * WGS-72 constants used by NORAD two-line element sets (SGP4).
 * TLE mean motions are "Kozai" mean motions defined with these values.
 */
export const WGS72 = {
  radiusKm: 6378.135,
  mu: 398600.8,
  j2: 0.001082616,
  /** sqrt(μ / Re³) in Earth radii^1.5 per minute */
  ke: 60 / Math.sqrt((6378.135 * 6378.135 * 6378.135) / 398600.8),
} as const
