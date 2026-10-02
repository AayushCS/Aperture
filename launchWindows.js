// Launch window calculator for Spaceport Nova Scotia (Track 1).
//
// The core idea: an orbit is a fixed ring in space, and the launch site rotates
// under it once a day. The launch window is the moment the site is lined up
// with that ring, so the rocket can fly straight into it.
//
// Formulas: standard launch window equations, see
// "Launch Windows and Time", Introduction to Orbital Mechanics (Univ. of Colorado),
// https://colorado.pressbooks.pub/introorbitalmechanics/chapter/launch-windows-and-time/
//
// Works in the browser (<script type="module">) and in Node.

const DEG = Math.PI / 180;

// Earth turns 360.9856° per day relative to the stars (a bit more than 360°,
// because Earth also moves along its path around the Sun).
export const EARTH_DEG_PER_DAY = 360.98564736629;
const MS_PER_DAY = 86400000;

// Confirm the exact coordinates with the Maritime Launch mentors.
export const SITE = {
  name: "Spaceport Nova Scotia",
  lat: 45.1, // degrees north
  lon: -61.0, // degrees east (negative = west)
};

// From the challenge slide. "south: true" means the rocket flies south over
// the Atlantic, which is how polar and sun-synchronous orbits launch from here.
export const ORBITS = {
  LEO: { name: "Low Earth Orbit", inclination: 45.1, south: false },
  POLAR: { name: "Polar", inclination: 90.0, south: true },
  SSO: { name: "Sun-synchronous", inclination: 98.1, south: true },
};

// ---------- small helpers ----------

/** Wrap any angle into the range 0..360. */
export function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Wrap an angle into the range -180..180 (useful for small differences). */
export function signed180(deg) {
  return norm360(deg + 180) - 180;
}

/** Keep a value inside -1..1 so tiny rounding errors don't break asin. */
function clamp1(x) {
  return Math.max(-1, Math.min(1, x));
}

// ---------- Formula 1: is the orbit reachable from this site? ----------

/** An orbit is reachable only if its tilt is at least the site's latitude. */
export function isReachable(inclination, lat = SITE.lat) {
  return inclination >= lat - 1e-9 && inclination <= 180 - lat + 1e-9;
}

// ---------- Formula 2: which direction does the rocket fly? ----------

/**
 * Launch azimuth in degrees clockwise from north (90 = east, 180 = south).
 * sin(β) = cos(i) / cos(φ)
 */
export function launchAzimuth(inclination, lat = SITE.lat, south = false) {
  const betaNorth = Math.asin(clamp1(Math.cos(inclination * DEG) / Math.cos(lat * DEG))) / DEG;
  return norm360(south ? 180 - betaNorth : betaNorth);
}

// ---------- Formula 3: where must the Earth be turned to? ----------

/**
 * Δλ: how far (in degrees, around the equator) the site sits from the point
 * where the orbit crosses the equator going north.
 * sin(Δλ) = tan(φ) / tan(i)
 */
export function nodeOffset(inclination, lat = SITE.lat) {
  return Math.asin(clamp1(Math.tan(lat * DEG) / Math.tan(inclination * DEG))) / DEG;
}

/**
 * The Earth-rotation angle (local sidereal time, in degrees) the site must be
 * at for a launch into an orbit whose plane faces direction `raan`.
 * Northbound: Ω + Δλ      Southbound: Ω + 180° − Δλ
 */
export function targetSiderealAngle(inclination, raan, lat = SITE.lat, south = false) {
  const dl = nodeOffset(inclination, lat);
  return norm360(south ? raan + 180 - dl : raan + dl);
}

// ---------- Formula 4: turn the angle into a clock time ----------

/** Days since 2000-01-01 12:00 UTC (the J2000 reference moment). */
export function daysSinceJ2000(date) {
  return date.getTime() / MS_PER_DAY + 2440587.5 - 2451545.0;
}

/** How far the Earth has turned, measured at Greenwich (degrees). */
export function gmst(date) {
  return norm360(280.46061837 + EARTH_DEG_PER_DAY * daysSinceJ2000(date));
}

/** How far the Earth has turned, measured at the launch site (degrees). */
export function localSiderealAngle(date, lon = SITE.lon) {
  return norm360(gmst(date) + lon);
}

// ---------- SSO extra: the orbit plane follows the Sun ----------

/** The Sun's right ascension (its east-west position in the sky), in degrees. Low-precision almanac formula. */
export function sunRightAscension(date) {
  const n = daysSinceJ2000(date);
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  return norm360(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG);
}

/**
 * For a sun-synchronous orbit, missions pick the local time the satellite
 * crosses the equator going south (10:30am is common). That fixes Ω relative
 * to the Sun: Ω = Sun RA + (northbound crossing time − 12h) × 15°,
 * and the northbound crossing is 12 hours after the southbound one.
 */
export function ssoRaan(date, southboundCrossingHours = 10.5) {
  const northbound = southboundCrossingHours + 12;
  return norm360(sunRightAscension(date) + (northbound - 12) * 15);
}

// ---------- The window finder ----------

/**
 * Find the next `count` launch windows.
 *
 * @param {"LEO"|"POLAR"|"SSO"} orbitKey
 * @param {object} opts
 * @param {number} [opts.raan]         Ω in degrees (required for LEO and POLAR)
 * @param {number} [opts.crossingHours] SSO southbound equator crossing, local solar time (default 10.5)
 * @param {Date}   [opts.start]        search from this moment (default now)
 * @param {number} [opts.count]        how many windows (default 5)
 * @param {object} [opts.site]         { lat, lon } (default SITE)
 */
export function findWindows(orbitKey, opts = {}) {
  const orbit = ORBITS[orbitKey];
  if (!orbit) throw new Error(`Unknown orbit type: ${orbitKey}`);
  const site = opts.site ?? SITE;
  const count = opts.count ?? 5;
  const { inclination, south } = orbit;

  if (!isReachable(inclination, site.lat)) {
    return { orbit: orbitKey, reachable: false, windows: [] };
  }

  // Ω can be a fixed number, or (for SSO) something that changes with the date.
  let raanAt;
  if (orbitKey === "SSO" && opts.raan === undefined) {
    raanAt = (d) => ssoRaan(d, opts.crossingHours ?? 10.5);
  } else {
    if (typeof opts.raan !== "number") throw new Error(`${orbitKey} needs a raan (Ω) in degrees`);
    raanAt = () => opts.raan;
  }

  const azimuth = launchAzimuth(inclination, site.lat, south);
  const windows = [];
  let from = opts.start ? new Date(opts.start) : new Date();

  // Gap between where the site is and where it needs to be, in degrees.
  const gapAt = (d) =>
    targetSiderealAngle(inclination, raanAt(d), site.lat, south) - localSiderealAngle(d, site.lon);

  for (let k = 0; k < count; k++) {
    // The site catches up with the orbit plane at (Earth's turning speed − how
    // fast the plane itself drifts). The plane is fixed for LEO and Polar; for
    // SSO it drifts ~1°/day to follow the Sun, so windows repeat every 24h.
    const drift = signed180(raanAt(new Date(from.getTime() + MS_PER_DAY)) - raanAt(from));
    const catchUpRate = EARTH_DEG_PER_DAY - drift; // degrees per day

    // Degrees still to go, converted into time...
    let t = new Date(from.getTime() + (norm360(gapAt(from)) / catchUpRate) * MS_PER_DAY);
    // ...then a few small corrections to land exactly on it.
    for (let iter = 0; iter < 3; iter++) {
      t = new Date(t.getTime() + (signed180(gapAt(t)) / catchUpRate) * MS_PER_DAY);
    }
    windows.push({
      time: t,
      utc: t.toISOString(),
      local: t.toLocaleString("en-CA", { timeZone: "America/Halifax", dateStyle: "medium", timeStyle: "short" }),
      azimuth: Math.round(azimuth * 10) / 10,
      direction: south ? "southbound" : "northbound",
    });
    from = new Date(t.getTime() + 60 * 1000); // start the next search 1 minute later
  }

  return { orbit: orbitKey, reachable: true, inclination, azimuth, windows };
}
