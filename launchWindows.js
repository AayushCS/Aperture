// Launch window calculator for Spaceport Nova Scotia (Track 1).
//
// The core idea: an orbit is a fixed ring in space, and the launch site rotates
// under it once a day. When the site lines up with that ring, the rocket can fly
// straight into it. We call that moment the "alignment instant"; the launch
// window is a few minutes either side of it (see `toleranceDeg`).
//
// Formulas: standard launch window equations, see
// "Launch Windows and Time", Introduction to Orbital Mechanics (Univ. of Colorado),
// https://colorado.pressbooks.pub/introorbitalmechanics/chapter/launch-windows-and-time/
//
// Reference frame: angles like RAAN (Ω) are measured in an Earth-centred frame
// that does not spin with the Earth, using the mean equator and equinox of the
// launch date (that is what the GMST formula below gives). Orbit data quoted
// for the year-2000 frame (J2000) differs by about 0.36° in 2026, which shifts a
// window by roughly 1.4 minutes. Good enough for planning; not for flight.
//
// Works in the browser (<script type="module">) and in Node.

const DEG = Math.PI / 180;
const MS_PER_DAY = 86400000;

// ---------- Physical constants ----------
export const EARTH_DEG_PER_DAY = 360.98564736629; // Earth's spin relative to the stars
export const MU_EARTH = 398600.4418; // km³/s², Earth's gravity constant
export const R_EARTH = 6378.137; // km, equatorial radius
export const J2 = 1.08263e-3; // how much Earth bulges at the equator
export const EARTH_FLATTENING = 1 / 298.257223563;
export const EQUATOR_SPEED_MS = 465.1; // m/s, how fast the equator moves because of Earth's spin

// ---------- Site and rules ----------
// Coordinates: the pad is ~3.5 km south of Canso. The challenge implies 45.1°N;
// other sources point to ~45.3°N. Confirm with Maritime Launch and change here.
export const SITE = {
  name: "Spaceport Nova Scotia",
  lat: 45.3, // degrees north (geodetic, as on a map)
  lon: -61.0, // degrees east (negative = west)
  timeZone: "America/Halifax",
  rules: {
    // 2018 environmental assessment: launches "primarily between 7:00 a.m. and 12:00 p.m."
    allowedHours: [7, 12],
    // Same document: "all launches will be conducted to the south over the Atlantic".
    // The exact allowed range is NOT confirmed, so it is switched off (null) by default.
    // Example once confirmed: [90, 200] (degrees clockwise from north).
    allowedAzimuth: null,
  },
};

// The challenge's three presets. Every value can be overridden in findWindows().
// SSO altitude: 98.1° is sun-synchronous at about 690 km (see ssoInclination()).
export const ORBITS = {
  LEO: { name: "Low Earth Orbit", inclination: 45.1, altitudeKm: 500, south: false },
  POLAR: { name: "Polar", inclination: 90.0, altitudeKm: 600, south: true },
  SSO: { name: "Sun-synchronous", inclination: 98.1, altitudeKm: 690, south: true },
};

// ---------- Small helpers ----------

/** Wrap any angle into the range 0..360. */
export function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Wrap an angle into the range -180..180 (useful for small differences). */
export function signed180(deg) {
  return norm360(deg + 180) - 180;
}

/** asin that only forgives tiny rounding errors, never real out-of-range input. */
function safeAsin(x, what) {
  if (Math.abs(x) > 1 + 1e-9) throw new RangeError(`${what}: value ${x} is out of range (orbit not reachable)`);
  return Math.asin(Math.max(-1, Math.min(1, x)));
}

function checkNumber(value, name, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} must be a number`);
  if (value < min || value > max) throw new RangeError(`${name} must be between ${min} and ${max} (got ${value})`);
}

function checkDate(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError(`${name} must be a valid Date`);
}

/**
 * Map latitude → Earth-centred latitude. Earth is slightly squashed, so the
 * angle from Earth's centre is a little smaller than the map latitude
 * (45.1° → 44.91°). Optional: pass useGeocentric: true to findWindows().
 */
export function geocentricLat(lat) {
  return Math.atan((1 - EARTH_FLATTENING) ** 2 * Math.tan(lat * DEG)) / DEG;
}

/** Turn a compass heading into words, e.g. 90 → "E", 191.5 → "SSW". */
export function compassLabel(azimuth) {
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round(norm360(azimuth) / 22.5) % 16];
}

/** Orbital speed of a circular orbit at this altitude, in m/s. */
export function orbitalSpeed(altitudeKm) {
  return Math.sqrt(MU_EARTH / (R_EARTH + altitudeKm)) * 1000;
}

// ---------- Formula 1: is the orbit reachable from this site? ----------

/** Reachable only if the orbit's tilt is at least the site's distance from the equator. */
export function isReachable(inclination, lat = SITE.lat) {
  const a = Math.abs(lat);
  return inclination >= a - 1e-9 && inclination <= 180 - a + 1e-9;
}

// ---------- Formula 2: which direction does the rocket fly? ----------

/**
 * Ideal heading in space (inertial azimuth), degrees clockwise from north.
 * sin(β) = cos(i) / cos(φ). Throws if the orbit is not reachable.
 */
export function launchAzimuth(inclination, lat = SITE.lat, south = false) {
  if (!isReachable(inclination, lat)) throw new RangeError(`Inclination ${inclination}° is not reachable from latitude ${lat}°`);
  const betaNorth = safeAsin(Math.cos(inclination * DEG) / Math.cos(lat * DEG), "launchAzimuth") / DEG;
  return norm360(south ? 180 - betaNorth : betaNorth);
}

/**
 * Heading as seen from the ground. The pad is already moving east with the
 * Earth, so the rocket aims slightly differently from the ideal heading in space.
 * Due east stays due east; SSO turns a couple of degrees further west.
 */
export function groundAzimuth(inertialAzimuth, lat, altitudeKm) {
  const v = orbitalSpeed(altitudeKm);
  const vEast = v * Math.sin(inertialAzimuth * DEG) - EQUATOR_SPEED_MS * Math.cos(lat * DEG);
  const vNorth = v * Math.cos(inertialAzimuth * DEG);
  return norm360(Math.atan2(vEast, vNorth) / DEG);
}

/** Free speed from Earth's spin along the launch direction (m/s). Negative = penalty. */
export function rotationBoost(inertialAzimuth, lat) {
  return EQUATOR_SPEED_MS * Math.cos(lat * DEG) * Math.sin(inertialAzimuth * DEG);
}

// ---------- Formula 3: where must the Earth be turned to? ----------

/** Δλ: sin(Δλ) = tan(φ) / tan(i). Throws if the orbit is not reachable. */
export function nodeOffset(inclination, lat = SITE.lat) {
  if (!isReachable(inclination, lat)) throw new RangeError(`Inclination ${inclination}° is not reachable from latitude ${lat}°`);
  return safeAsin(Math.tan(lat * DEG) / Math.tan(inclination * DEG), "nodeOffset") / DEG;
}

/** Earth-rotation angle the site must reach. Northbound: Ω + Δλ. Southbound: Ω + 180° − Δλ. */
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

// ---------- Orbit drift (Earth's bulge slowly turns every orbit) ----------

/** How fast the orbit's Ω drifts, in degrees per day (J2 effect). */
export function raanDriftPerDay(inclination, altitudeKm, eccentricity = 0) {
  const a = R_EARTH + altitudeKm;
  const n = Math.sqrt(MU_EARTH / a ** 3); // rad/s
  const rate = -1.5 * n * J2 * (R_EARTH / a) ** 2 * Math.cos(inclination * DEG) / (1 - eccentricity ** 2) ** 2;
  return (rate / DEG) * 86400;
}

// ---------- Sun-synchronous orbits ----------

/** Inclination needed for an orbit at this altitude to be sun-synchronous. */
export function ssoInclination(altitudeKm, eccentricity = 0) {
  const a = R_EARTH + altitudeKm;
  const n = Math.sqrt(MU_EARTH / a ** 3);
  const sunRate = (2 * Math.PI) / (365.2422 * 86400); // the Sun's apparent motion, rad/s
  const cosI = (-sunRate * (1 - eccentricity ** 2) ** 2) / (1.5 * n * J2 * (R_EARTH / a) ** 2);
  if (Math.abs(cosI) > 1) throw new RangeError("No sun-synchronous orbit exists at this altitude");
  return Math.acos(cosI) / DEG;
}

/** True if this inclination is sun-synchronous at this altitude (within tolerance). */
export function isSunSynchronous(inclination, altitudeKm, eccentricity = 0, toleranceDeg = 0.1) {
  return Math.abs(inclination - ssoInclination(altitudeKm, eccentricity)) <= toleranceDeg;
}

/**
 * The Sun's right ascension (east-west position in the sky), in degrees.
 * "apparent" = the real Sun; "mean" = an imaginary Sun moving at a steady pace.
 * Clocks, and satellite crossing times, use the mean Sun. The two differ by up
 * to ~16 minutes during the year (about 10 minutes in early October).
 */
export function sunRightAscension(date, kind = "apparent") {
  const n = daysSinceJ2000(date);
  const L = 280.46 + 0.9856474 * n; // mean longitude
  if (kind === "mean") return norm360(L);
  const g = (357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  return norm360(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG);
}

/**
 * Ω for a sun-synchronous orbit whose southbound equator crossing happens at
 * `southboundCrossingHours` local MEAN solar time (10:30am is common).
 */
export function ssoRaan(date, southboundCrossingHours = 10.5, solarTime = "mean") {
  const northbound = southboundCrossingHours + 12;
  return norm360(sunRightAscension(date, solarTime) + (northbound - 12) * 15);
}

// ---------- Rules (regulations) ----------

/** Local clock time at the site as decimal hours, e.g. 11:30 → 11.5. */
export function localHours(date, timeZone = SITE.timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get("hour") + get("minute") / 60;
}

/** Returns a list of reasons this launch is not allowed (empty list = allowed). */
export function checkRules(time, azimuth, rules = SITE.rules, timeZone = SITE.timeZone) {
  const reasons = [];
  if (rules?.allowedHours) {
    const [from, to] = rules.allowedHours;
    const h = localHours(time, timeZone);
    if (h < from || h > to) reasons.push(`outside launch hours (${from}:00–${to}:00)`);
  }
  if (rules?.allowedAzimuth) {
    const [from, to] = rules.allowedAzimuth;
    if (azimuth < from || azimuth > to) reasons.push(`launch direction ${azimuth.toFixed(1)}° not permitted (${from}°–${to}°)`);
  }
  return reasons;
}

// ---------- The window finder ----------

/**
 * Find the next `count` launch windows.
 *
 * @param {"LEO"|"POLAR"|"SSO"|"CUSTOM"} orbitKey  preset name ("CUSTOM" needs inclination)
 * @param {object}  [opts]
 * @param {number}  [opts.inclination]   override the preset's tilt (degrees, 0–180)
 * @param {number}  [opts.altitudeKm]    orbit altitude (km)
 * @param {boolean} [opts.south]         launch southbound (default from preset; CUSTOM: true if inclination > 90)
 * @param {number}  [opts.raan]          Ω in degrees (needed for LEO, POLAR, CUSTOM; optional for SSO)
 * @param {Date}    [opts.raanEpoch]     the date `raan` was measured; if given, Ω drifts with Earth's bulge
 * @param {number}  [opts.crossingHours] SSO southbound crossing, local mean solar time (default 10.5)
 * @param {"mean"|"apparent"} [opts.solarTime] how crossingHours is measured (default "mean")
 * @param {number}  [opts.toleranceDeg]  how far off the plane is acceptable (default 0.5° ≈ ±2 min)
 * @param {Date}    [opts.start]         search from this moment (default now)
 * @param {number}  [opts.count]         how many windows (default 5)
 * @param {object}  [opts.site]          { lat, lon, timeZone, rules } (default SITE)
 * @param {boolean} [opts.useGeocentric] use Earth-centred latitude in the geometry (default false)
 */
export function findWindows(orbitKey, opts = {}) {
  const preset = orbitKey === "CUSTOM" ? {} : ORBITS[orbitKey];
  if (!preset) throw new Error(`Unknown orbit type: ${orbitKey}`);

  const site = { ...SITE, ...(opts.site ?? {}) };
  const inclination = opts.inclination ?? preset.inclination;
  const altitudeKm = opts.altitudeKm ?? preset.altitudeKm ?? 500;
  const count = opts.count ?? 5;
  const toleranceDeg = opts.toleranceDeg ?? 0.5;
  const start = opts.start ?? new Date();

  // ---- validate inputs ----
  checkNumber(inclination, "inclination", 0, 180);
  checkNumber(altitudeKm, "altitudeKm", 160, 40000);
  checkNumber(site.lat, "site latitude", -90, 90);
  checkNumber(site.lon, "site longitude", -180, 180);
  checkNumber(toleranceDeg, "toleranceDeg", 0, 10);
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new RangeError("count must be a whole number from 1 to 1000");
  checkDate(start, "start");
  if (opts.raan !== undefined) checkNumber(opts.raan, "raan", -360, 360);
  if (opts.raanEpoch !== undefined) checkDate(opts.raanEpoch, "raanEpoch");
  if (opts.crossingHours !== undefined) checkNumber(opts.crossingHours, "crossingHours", 0, 24);

  const south = opts.south ?? preset.south ?? inclination > 90;
  const lat = opts.useGeocentric ? geocentricLat(site.lat) : site.lat;
  const base = { orbit: orbitKey, inclination, altitudeKm, latitudeUsed: lat };

  if (!isReachable(inclination, lat)) {
    return { ...base, reachable: false, reason: `A ${inclination}° orbit is flatter than the site's latitude (${lat.toFixed(2)}°)`, windows: [] };
  }

  // ---- how the orbit plane's direction (Ω) behaves over time ----
  let raanAt;
  if (orbitKey === "SSO" && opts.raan === undefined) {
    const crossing = opts.crossingHours ?? 10.5;
    const solarTime = opts.solarTime ?? "mean";
    raanAt = (d) => ssoRaan(d, crossing, solarTime);
  } else {
    if (opts.raan === undefined) throw new Error(`${orbitKey} needs a raan (Ω) in degrees`);
    const drift = opts.raanEpoch ? raanDriftPerDay(inclination, altitudeKm) : 0;
    const epoch = opts.raanEpoch ?? start;
    raanAt = (d) => opts.raan + drift * ((d - epoch) / MS_PER_DAY);
  }

  const azimuth = launchAzimuth(inclination, lat, south);
  const azGround = groundAzimuth(azimuth, lat, altitudeKm);
  const gapAt = (d) => targetSiderealAngle(inclination, raanAt(d), lat, south) - localSiderealAngle(d, site.lon);

  const windows = [];
  let from = new Date(start);
  for (let k = 0; k < count; k++) {
    // The site catches up with the plane at (Earth's spin − the plane's own drift).
    const drift = signed180(raanAt(new Date(from.getTime() + MS_PER_DAY)) - raanAt(from));
    const catchUpRate = EARTH_DEG_PER_DAY - drift; // degrees per day

    let t = new Date(from.getTime() + (norm360(gapAt(from)) / catchUpRate) * MS_PER_DAY);
    for (let iter = 0; iter < 3; iter++) {
      t = new Date(t.getTime() + (signed180(gapAt(t)) / catchUpRate) * MS_PER_DAY);
    }

    const halfWidthMs = (toleranceDeg / catchUpRate) * MS_PER_DAY;
    const blockedReasons = checkRules(t, azGround, site.rules, site.timeZone);
    windows.push({
      alignment: t, // the exact moment the site is under the orbit plane
      opens: new Date(t.getTime() - halfWidthMs),
      closes: new Date(t.getTime() + halfWidthMs),
      utc: t.toISOString(),
      local: t.toLocaleString("en-CA", { timeZone: site.timeZone, dateStyle: "medium", timeStyle: "short" }),
      allowed: blockedReasons.length === 0,
      blockedReasons,
    });
    from = new Date(t.getTime() + 60 * 1000);
  }

  return {
    ...base,
    reachable: true,
    south,
    azimuth, // ideal heading in space
    groundAzimuth: azGround, // heading the rocket actually aims along
    heading: compassLabel(azGround), // e.g. "E", "S", "SSW"
    rotationBoostMs: rotationBoost(azimuth, lat),
    sunSynchronous: inclination > 90 ? isSunSynchronous(inclination, altitudeKm) : false,
    toleranceDeg,
    windows,
  };
}
