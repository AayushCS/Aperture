import { describe, expect, test } from 'bun:test'
import {
  COMMON_LAUNCH_SITES,
  COMMON_VEHICLES,
  HYPOTHETICAL_MISSION_TLE,
  ORBIT_ALTITUDE,
  ORBIT_PLANE,
  OrbitalEngine,
  CalculationInputSchema,
  EARTH_RADIUS_KM,
  anomalisticPeriod,
  apogeeAltitude,
  assessWeather,
  calculateDistance,
  circularVelocity,
  classifyOrbit,
  climatologicalWeather,
  corridorMargin,
  degToRad,
  destinationPoint,
  elementsAt,
  elementsToTle,
  formatTle,
  gmst,
  groundTrack,
  keplerianToCartesian,
  kozaiToSemiMajorAxis,
  localSolarTime,
  zonedDate,
  zonedTimeToUtc,
  maxApogeeAltitude,
  ltanAt,
  meanSunRightAscension,
  orbitTraffic,
  parseGpRecord,
  prepareScreeningObjects,
  screenWindow,
  semiMajorAxisFromMeanMotion,
  meanToTrueAnomaly,
  nextWindow,
  nodalPrecession,
  normalizeAngle,
  orbitFromTle,
  orbitRing,
  orbitalPeriod,
  parseTle,
  perigeeAltitude,
  planeGeometry,
  secularRates,
  propagate,
  raanForLtan,
  radToDeg,
  radiusAt,
  semiMajorAxisToKozai,
  shapeFromApsides,
  solveKepler,
  sunElevation,
  sunPosition,
  sunSynchronousInclination,
  sunSynchronousInclinationFor,
  tleChecksum,
  tleToElements,
  tleToText,
  trueToMeanAnomaly,
  visibilityRadius,
  weatherAt,
  type CalculationInput,
  type HourlyWeather,
  type LaunchSite,
  type OrbitalElements,
  type VehicleParams,
} from '../src'

// ---------------------------------------------------------------------------
// Fixtures. Reference sites and vehicles exercise the physics against
// well-known missions; the app itself only ships Spaceport Nova Scotia.
// ---------------------------------------------------------------------------

const KSC: LaunchSite = {
  name: 'Kennedy Space Center',
  latitude: 28.5729,
  longitude: -80.6489,
  altitude: 3,
  azimuthCorridors: [[35, 120]],
  climate: 'subtropical-coastal',
}
const VANDENBERG: LaunchSite = {
  name: 'Vandenberg',
  latitude: 34.742,
  longitude: -120.5724,
  altitude: 112,
  azimuthCorridors: [[145, 210]],
  climate: 'mediterranean-coastal',
}
const GUIANA: LaunchSite = { name: 'Kourou', latitude: 5.239, longitude: -52.768, altitude: 10, azimuthCorridors: [[349.5, 93.5]] }
const FALCON_9: VehicleParams = { name: 'Falcon 9', ascentDuration: 522, minInclination: 0, maxInclination: 140, maxAltitude: 2000 }
const ELECTRON: VehicleParams = { name: 'Electron', ascentDuration: 540, minInclination: 37, maxInclination: 120, maxAltitude: 1200 }

const NOVA_SCOTIA = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA
const SPECTRUM = COMMON_VEHICLES.SPECTRUM

const engine = new OrbitalEngine()
const START = new Date('2026-03-01T00:00:00Z')
const days = (n: number, from = START) => new Date(from.getTime() + n * 86_400_000)

function circular(altitude: number, inclination: number, raan = 0, epoch = START): OrbitalElements {
  return { epoch, semiMajorAxis: EARTH_RADIUS_KM + altitude, eccentricity: 0, inclination, raan, argOfPerigee: 0, meanAnomaly: 0 }
}

function input(overrides: Partial<CalculationInput> & { orbit: OrbitalElements }): CalculationInput {
  return { vehicle: FALCON_9, launchSite: KSC, dateRange: { start: START, end: days(7) }, ...overrides }
}

const ISS = input({ orbit: circular(420, 51.64, 120) })
const sso = (altitude: number, ltan = 22.5, inc = sunSynchronousInclination(altitude)) =>
  ({ ...circular(altitude, inc), raan: raanForLtan(ltan, START) }) satisfies OrbitalElements

// Real element sets (CelesTrak format). GEO lines were repaired: the source had no
// space between mean motion and revolution number, which made them 68 characters.
const TLES = {
  RADARSAT2: `RADARSAT-2
1 32382U 07061A   25297.86575773  .00000116  00000+0  61896-4 0  9996
2 32382  98.5813 303.1603 0001129  89.7632 270.3680 14.29982529932324`,
  SAPPHIRE: `SAPPHIRE
1 39088U 13009C   25297.72717685  .00000254  00000-0  10395-3 0  9991
2 39088  98.4172 117.8868 0010342 226.4031 133.6297 14.35131764662806`,
  COSMOS2518: `COSMOS 2518
1 42719U 17027A   25287.72825124  .00000666  00000-0  00000-0 0  9993
2 42719  63.0708 279.0648 7105048 273.0899  14.9804  2.00754526 61473`,
  RCM3: `RCM-3
1 44323U 19033B   25299.25775890 -.00000137  00000+0 -78837-5 0  9992
2 44323  97.7597 305.1540 0001516  90.5747 269.5646 14.92588364347209`,
  TELSTAR19V: `TELSTAR 19V
1 43562U 18059A   25299.24762231 -.00000268  00000+0  00000+0 0  9992
2 43562   0.0189 207.5968 0002652 319.9938 253.4558  1.00271404 26799`,
} as const

describe('astronomy', () => {
  test('GMST at J2000.0 epoch is 280.46°', () => {
    expect(gmst(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(280.4606, 3)
  })

  test('solar declination at solstices and equinox', () => {
    expect(sunPosition(new Date('2026-06-21T12:00:00Z')).declination).toBeCloseTo(23.44, 1)
    expect(sunPosition(new Date('2026-12-21T12:00:00Z')).declination).toBeCloseTo(-23.44, 1)
    expect(Math.abs(sunPosition(new Date('2026-03-20T15:00:00Z')).declination)).toBeLessThan(0.1)
  })

  test('sun is high at local noon and below horizon at local midnight (KSC)', () => {
    expect(sunElevation(new Date('2026-06-21T17:25:00Z'), KSC.latitude, KSC.longitude)).toBeGreaterThan(80)
    expect(sunElevation(new Date('2026-06-21T05:25:00Z'), KSC.latitude, KSC.longitude)).toBeLessThan(-30)
  })

  test('local solar time follows longitude', () => {
    expect(localSolarTime(new Date('2026-01-01T12:00:00Z'), 0)).toBeCloseTo(12, 6)
    expect(localSolarTime(new Date('2026-01-01T12:00:00Z'), -90)).toBeCloseTo(6, 6)
  })
})

describe('TLE', () => {
  test('parses fields, epoch and checksums', () => {
    const r = parseTle(TLES.RADARSAT2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.tle.name).toBe('RADARSAT-2')
    expect(r.tle.catalogNumber).toBe('32382')
    expect(r.tle.intlDesignator).toBe('07061A')
    expect(r.tle.inclination).toBe(98.5813)
    expect(r.tle.eccentricity).toBeCloseTo(0.0001129, 10)
    expect(r.tle.meanMotion).toBe(14.29982529)
    expect(r.tle.revolutionNumber).toBe(93232)
    expect(r.tle.bstar).toBeCloseTo(0.61896e-4, 12)
    expect(r.tle.meanMotionDot).toBeCloseTo(0.00000116, 12)
    // Day 297.86575773 of 2025 = 24 Oct 2025 20:46:41 UTC
    expect(r.tle.epoch.toISOString().slice(0, 19)).toBe('2025-10-24T20:46:41')
  })

  test('negative exponent fields and "0 NAME" lines', () => {
    const r = parseTle(`0 ${TLES.RCM3}`)
    expect(r.ok && r.tle.name).toBe('RCM-3')
    expect(r.ok && r.tle.bstar).toBeCloseTo(-0.78837e-5, 12)
    expect(r.ok && r.tle.meanMotionDot).toBeCloseTo(-0.00000137, 12)
  })

  test('formatting round-trips real element sets exactly', () => {
    // Zero exponent fields are written "00000-0" or "00000+0" by different producers; we emit "+0"
    const normalise = (line: string) => {
      const body = line.slice(0, 68).replace(/([ -])00000-0/g, '$100000+0')
      return `${body}${tleChecksum(body)}`
    }
    for (const text of Object.values(TLES)) {
      const r = parseTle(text)
      expect(r.ok).toBe(true)
      if (r.ok) expect(formatTle(r.tle)).toEqual([normalise(r.lines[0]), normalise(r.lines[1])])
    }
  })

  test('rejects bad checksums, wrong lengths and mismatched catalog numbers', () => {
    const [name, l1, l2] = TLES.RADARSAT2.split('\n') as [string, string, string]
    const badSum = parseTle(`${name}\n${l1.slice(0, 68)}0\n${l2}`)
    expect(badSum.ok).toBe(false)
    expect(!badSum.ok && badSum.errors[0]).toContain('checksum')

    const short = parseTle(`${l1}\n2 28868   3.7099  79.4665 0001890 101.2857 216.7569  1.0027254744104`)
    expect(!short.ok && short.errors[0]).toContain('68 characters')

    const body = `2 32383${l2.slice(7, 68)}`
    expect(parseTle(`${l1}\n${body}${tleChecksum(body)}`).ok).toBe(false)
    expect(parseTle('hello').ok).toBe(false)
  })

  test('Kozai mean motion ↔ Brouwer semi-major axis', () => {
    const a = kozaiToSemiMajorAxis(14.29982529, 0.0001129, 98.5813)
    // ≈ 798 km above the mean Earth radius
    expect(a - 6371).toBeGreaterThan(790)
    expect(a - 6371).toBeLessThan(805)
    expect(semiMajorAxisToKozai(a, 0.0001129, 98.5813)).toBeCloseTo(14.29982529, 9)
  })

  test('elements → TLE → elements is lossless to TLE precision', () => {
    const el = { ...sso(550), eccentricity: 0.012, argOfPerigee: 123.4567, meanAnomaly: 10 }
    const text = tleToText(elementsToTle(el, { name: 'TEST', catalogNumber: '99999' }))
    const back = orbitFromTle(text)
    expect(back.semiMajorAxis).toBeCloseTo(el.semiMajorAxis, 3)
    expect(back.inclination).toBeCloseTo(el.inclination, 4)
    expect(back.raan).toBeCloseTo(el.raan, 4)
    expect(Math.abs(back.epoch.getTime() - el.epoch.getTime())).toBeLessThan(5)
  })
})

describe('elliptical orbit model', () => {
  test('classes inferred from real TLEs', () => {
    const cls = (t: string) => classifyOrbit(orbitFromTle(t))
    expect(cls(TLES.RADARSAT2)).toBe('SSO')
    expect(cls(TLES.RCM3)).toBe('SSO')
    expect(cls(TLES.COSMOS2518)).toBe('HEO')
    expect(cls(TLES.TELSTAR19V)).toBe('GEO')
    expect(classifyOrbit(circular(420, 51.64))).toBe('LEO')
    expect(classifyOrbit(circular(700, 90))).toBe('POLAR')
  })

  test('geostationary period is one sidereal day', () => {
    expect(anomalisticPeriod(orbitFromTle(TLES.TELSTAR19V))).toBeCloseTo(86_164, -2)
  })

  test('Kepler anomaly conversions round-trip', () => {
    for (const e of [0, 0.02, 0.3, 0.71]) {
      for (const nu of [0, 45, 170, 300]) expect(meanToTrueAnomaly(trueToMeanAnomaly(nu, e), e)).toBeCloseTo(nu, 8)
    }
  })

  test('radius stays between perigee and apogee and matches at the apsides', () => {
    const el = orbitFromTle(TLES.COSMOS2518)
    const rp = perigeeAltitude(el) + EARTH_RADIUS_KM
    const ra = apogeeAltitude(el) + EARTH_RADIUS_KM
    expect(radiusAt(el, 0)).toBeCloseTo(rp, 6)
    expect(radiusAt(el, 180)).toBeCloseTo(ra, 6)
    for (let h = 0; h < 12; h++) {
      const s = propagate(el, new Date(el.epoch.getTime() + h * 3_600_000))
      expect(s.radius).toBeGreaterThanOrEqual(rp - 1e-6)
      expect(s.radius).toBeLessThanOrEqual(ra + 1e-6)
    }
  })

  test('apsides from altitudes', () => {
    const { semiMajorAxis, eccentricity } = shapeFromApsides(500, 800)
    expect(perigeeAltitude({ semiMajorAxis, eccentricity })).toBeCloseTo(500, 9)
    expect(apogeeAltitude({ semiMajorAxis, eccentricity })).toBeCloseTo(800, 9)
  })

  test('ground track latitude never exceeds inclination', () => {
    const track = groundTrack(circular(420, 51.64), START, 6000)
    const maxLat = Math.max(...track.map((p) => Math.abs(p.latitude)))
    expect(maxLat).toBeLessThanOrEqual(51.64 + 1e-6)
    expect(maxLat).toBeGreaterThan(51)
  })

  test('orbit ring closes on itself and spans the apsides', () => {
    const el = orbitFromTle(HYPOTHETICAL_MISSION_TLE)
    const ring = orbitRing(el, el.epoch, 90)
    expect(ring[0]!.latitude).toBeCloseTo(ring[ring.length - 1]!.latitude, 9)
    expect(Math.min(...ring.map((p) => p.radius)) - EARTH_RADIUS_KM).toBeCloseTo(500, 0)
    expect(Math.max(...ring.map((p) => p.radius)) - EARTH_RADIUS_KM).toBeCloseTo(800, 0)
  })

  test('sun-synchronous plane keeps its local time', () => {
    const el = sso(550, 22.5)
    expect(ltanAt(el, START)).toBeCloseTo(22.5, 6)
    expect(ltanAt(el, days(90))).toBeCloseTo(22.5, 0)
  })
})

describe('orbital mechanics', () => {
  test('ISS-like orbit period ≈ 92.8 min', () => {
    expect(orbitalPeriod(420) / 60).toBeCloseTo(92.8, 0)
  })

  test('J2 nodal precession for ISS ≈ −5°/day', () => {
    expect(nodalPrecession(420, 51.64)).toBeCloseTo(-5.0, 0)
  })

  test('sun-synchronous inclination matches published values', () => {
    expect(sunSynchronousInclination(500)).toBeCloseTo(97.4, 1)
    expect(sunSynchronousInclination(700)).toBeCloseTo(98.19, 1)
    expect(nodalPrecession(700, sunSynchronousInclination(700))).toBeCloseTo(0.9856, 3)
  })

  test('launch azimuth from KSC to ISS inclination ≈ 45° inertial', () => {
    const [ascending, descending] = planeGeometry(KSC.latitude, 51.64, circularVelocity(420))
    expect(ascending!.inertialAzimuth).toBeCloseTo(44.9, 0)
    expect(descending!.inertialAzimuth).toBeCloseTo(135.1, 0)
    expect(ascending!.azimuth).toBeCloseTo(42.7, 0)
    expect(descending!.azimuth).toBeCloseTo(137.3, 0)
  })

  test('inclination below site latitude is unreachable', () => {
    expect(planeGeometry(KSC.latitude, 20, 7.7)).toHaveLength(0)
  })
})

describe('launch windows', () => {
  test('ISS from KSC: one northeast window per day, drifting ~20+ min earlier daily', () => {
    const windows = engine.calculateLaunchWindows(ISS)
    expect(windows.length).toBeGreaterThanOrEqual(6)
    expect(windows.length).toBeLessThanOrEqual(8)
    for (const w of windows) {
      expect(w.branch).toBe('ascending')
      expect(w.azimuth).toBeGreaterThan(40)
      expect(w.azimuth).toBeLessThan(50)
      expect(w.start < w.optimal && w.optimal < w.end).toBe(true)
    }
    const gaps = windows.slice(1).map((w, i) => (w.optimal.getTime() - windows[i]!.optimal.getTime()) / 60_000)
    for (const gap of gaps) expect(gap).toBeGreaterThan(1440 - 30)
    for (const gap of gaps) expect(gap).toBeLessThan(1440 - 15)
  })

  test('the vehicle inserts into the target plane', () => {
    for (const mission of [ISS, input({ orbit: sso(550), launchSite: VANDENBERG })]) {
      for (const w of engine.calculateLaunchWindows(mission).slice(0, 3)) {
        const diff = normalizeAngle(w.orbit.raan - w.raan + 180) - 180
        expect(Math.abs(diff)).toBeLessThan(0.02)
      }
    }
  })

  test('liftoff leads the instant the pad crosses the plane (Earth turns during ascent)', () => {
    const [w] = engine.calculateLaunchWindows(ISS)
    const geometry = planeGeometry(KSC.latitude, 51.64, circularVelocity(420))[0]!
    const raanAtLiftoff = 120 + (nodalPrecession(420, 51.64) * (w!.optimal.getTime() - START.getTime())) / 86_400_000
    const residual = normalizeAngle(gmst(w!.optimal) + KSC.longitude - raanAtLiftoff - geometry.nodeOffset + 180) - 180
    // A few minutes of Earth rotation, not hours
    expect(Math.abs(residual)).toBeGreaterThan(0.1)
    expect(Math.abs(residual)).toBeLessThan(4)
  })

  test('windows never overlap', () => {
    const windows = engine.calculateLaunchWindows(input({ orbit: circular(600, 90), launchSite: VANDENBERG }))
    expect(windows.length).toBeGreaterThan(0)
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.start.getTime()).toBeGreaterThan(windows[i - 1]!.end.getTime())
    }
  })

  test('SSO from Vandenberg launches south at the same local time every day', () => {
    const windows = engine.calculateLaunchWindows(input({ orbit: sso(550), launchSite: VANDENBERG }))
    expect(windows.length).toBe(7)
    const times = windows.map((w) => localSolarTime(w.optimal, VANDENBERG.longitude))
    for (const t of times) expect(Math.abs(t - times[0]!)).toBeLessThan(0.1)
    for (const w of windows) expect(w.azimuth).toBeGreaterThan(180)
  })

  test('SSO RAAN is offset from the mean Sun by the LTAN hour angle', () => {
    const windows = engine.calculateLaunchWindows(input({ orbit: sso(550), launchSite: VANDENBERG }))
    expect(windows.length).toBeGreaterThan(0)
    for (const w of windows) {
      expect(normalizeAngle(w.raan - meanSunRightAscension(w.insertion.time))).toBeCloseTo((22.5 - 12) * 15, 1)
    }
  })

  test('SSO from KSC is rejected by the range-safety corridor', () => {
    const mission = input({ orbit: sso(550) })
    const analysis = engine.analyzeMission(mission)
    expect(analysis.feasible).toBe(false)
    expect(analysis.issues.map((i) => i.code)).toContain('AZIMUTH_RESTRICTED')
    expect(engine.calculateLaunchWindows(mission)).toHaveLength(0)
  })

  test('unreachable inclination, vehicle limits and decaying perigee are reported', () => {
    expect(engine.analyzeMission(input({ orbit: circular(400, 20) })).issues.map((i) => i.code)).toContain('INCLINATION_UNREACHABLE')
    const electron = engine.analyzeMission(input({ orbit: circular(1500, 51.6), vehicle: ELECTRON }))
    expect(electron.issues.map((i) => i.code)).toContain('VEHICLE_ALTITUDE')
    const low = engine.analyzeMission(input({ orbit: { ...circular(400, 51.6), semiMajorAxis: EARTH_RADIUS_KM + 400, eccentricity: 0.04 } }))
    expect(low.issues.map((i) => i.code)).toContain('PERIGEE_TOO_LOW')
  })

  test('near-SSO inclination produces a warning, not an error', () => {
    const a = engine.analyzeMission(input({ orbit: { ...sso(550), inclination: 97 }, launchSite: VANDENBERG }))
    expect(a.feasible).toBe(true)
    expect(a.sunSynchronous).toBe(false)
    expect(a.issues.map((i) => i.code)).toContain('NEAR_SUN_SYNCHRONOUS')
  })

  test('vehicle ascent duration sets insertion time and downrange point', () => {
    const [w] = engine.calculateLaunchWindows(ISS)
    expect((w!.insertion.time.getTime() - w!.optimal.getTime()) / 1000).toBe(FALCON_9.ascentDuration)
    const downrange = calculateDistance(KSC.latitude, KSC.longitude, w!.insertion.latitude, w!.insertion.longitude)
    expect(downrange).toBeGreaterThan(1200)
    expect(downrange).toBeLessThan(2500)
  })

  test('daylight constraint keeps only daytime liftoffs', () => {
    const windows = engine.calculateLaunchWindows({ ...ISS, dateRange: { start: START, end: days(30) }, constraints: { daylightOnly: true } })
    expect(windows.length).toBeGreaterThan(0)
    for (const w of windows) expect(w.lighting.sunElevation).toBeGreaterThan(-0.833)
  })

  test('weather constraint filters risky windows', () => {
    const wide = { ...ISS, dateRange: { start: new Date('2026-07-01T00:00:00Z'), end: new Date('2026-08-15T00:00:00Z') } }
    const all = engine.calculateLaunchWindows(wide)
    const lowOnly = engine.calculateLaunchWindows({ ...wide, constraints: { maxWeatherRisk: 'low' } })
    expect(lowOnly.length).toBeLessThan(all.length)
    for (const w of lowOnly) expect(w.weatherRisk).toBe('low')
  })

  test('RAAN tolerance controls window width', () => {
    const [narrow] = engine.calculateLaunchWindows({ ...ISS, constraints: { raanTolerance: 0.5 } })
    const [wide] = engine.calculateLaunchWindows({ ...ISS, constraints: { raanTolerance: 2 } })
    expect(wide!.duration).toBeCloseTo(narrow!.duration * 4, -1)
  })

  test('results are deterministic', () => {
    expect(JSON.stringify(engine.calculateLaunchWindows(ISS))).toBe(JSON.stringify(engine.calculateLaunchWindows(ISS)))
  })

  test('scores are bounded and visibility regions are populated', () => {
    for (const w of engine.calculateLaunchWindows(ISS)) {
      expect(w.quality).toBeGreaterThanOrEqual(0)
      expect(w.quality).toBeLessThanOrEqual(1)
      expect(w.visibilityRegions).toHaveLength(3)
      for (const r of w.visibilityRegions) expect(r.radius).toBeGreaterThan(0)
    }
  })

  test('nextWindow skips windows that have already closed', () => {
    const windows = engine.calculateLaunchWindows(ISS)
    const afterFirst = new Date(windows[0]!.end.getTime() + 1)
    expect(nextWindow(windows, afterFirst)?.id).toBe(windows[1]!.id)
  })

  test('as-flown orbit starts at the insertion point', () => {
    for (const mission of [ISS, input({ orbit: sso(550), launchSite: VANDENBERG })]) {
      const [w] = engine.calculateLaunchWindows(mission)
      const s = propagate(w!.orbit, w!.insertion.time)
      expect(calculateDistance(s.latitude, s.longitude, w!.insertion.latitude, w!.insertion.longitude)).toBeLessThan(5)
      expect(s.altitude).toBeCloseTo(w!.insertion.altitude, 3)
    }
  })
})

describe('Spaceport Nova Scotia', () => {
  const MISSION = orbitFromTle(HYPOTHETICAL_MISSION_TLE)
  const SEASON = new Date('2027-12-01T00:00:00Z')
  const mission = (orbit: OrbitalElements = MISSION, start = SEASON): CalculationInput => ({
    orbit,
    launchSite: NOVA_SCOTIA,
    vehicle: SPECTRUM,
    dateRange: { start, end: days(14, start) },
  })

  test('the hypothetical APERTURE-1 TLE is valid and describes a 500 × 800 km 10:30 SSO', () => {
    const r = parseTle(HYPOTHETICAL_MISSION_TLE)
    expect(r.ok).toBe(true)
    const a = engine.analyzeMission(mission())
    expect(a.orbitClass).toBe('SSO')
    expect(a.perigeeAltitudeKm).toBeCloseTo(500, 0)
    expect(a.apogeeAltitudeKm).toBeCloseTo(800, 0)
    expect(a.ltan).toBeCloseTo(22.5, 2)
    expect(a.feasible).toBe(true)
    expect(a.issues).toEqual([])
  })

  test('southbound only, one window per day, injecting at perigee', () => {
    const a = engine.analyzeMission(mission())
    expect(a.opportunities.find((o) => o.branch === 'ascending')!.withinCorridor).toBe(false)
    const windows = engine.calculateLaunchWindows(mission())
    expect(windows).toHaveLength(14)
    for (const w of windows) {
      expect(w.branch).toBe('descending')
      expect(w.azimuth).toBeGreaterThan(185)
      expect(w.azimuth).toBeLessThan(200)
      expect(w.insertion.altitude).toBeCloseTo(500, 0)
      expect(Math.min(w.insertion.trueAnomaly, 360 - w.insertion.trueAnomaly)).toBeLessThan(0.5)
    }
  })

  test('searching before the spaceport is operational is flagged', () => {
    const a = engine.analyzeMission(mission(MISSION, new Date('2026-10-03T00:00:00Z')))
    expect(a.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['SITE_NOT_OPERATIONAL', 'EPOCH_DISTANT']))
    expect(a.feasible).toBe(true)
  })

  test('rotating the perigee away from the insertion point raises the insertion altitude', () => {
    const a = engine.analyzeMission(mission({ ...MISSION, argOfPerigee: normalizeAngle(MISSION.argOfPerigee + 180) }))
    expect(a.issues.map((i) => i.code)).toContain('INSERTION_OFF_PERIGEE')
    expect(a.opportunities.find((o) => o.withinCorridor)!.insertionAltitude).toBeCloseTo(800, -1)
  })

  test('reachable inclinations: 45.3°–98°, GEO and low inclinations are not', () => {
    expect(engine.analyzeMission(mission(orbitFromTle(TLES.RADARSAT2))).feasible).toBe(true)
    const geo = engine.analyzeMission(mission(orbitFromTle(TLES.TELSTAR19V)))
    expect(geo.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['INCLINATION_UNREACHABLE', 'HIGH_ORBIT']))
    const east = engine.analyzeMission({ ...mission(circular(500, 45.4, 0, SEASON)), vehicle: COMMON_VEHICLES.REFERENCE_SMALL })
    expect(east.feasible).toBe(true)
    const allowed = east.opportunities.filter((o) => o.withinCorridor)
    expect(allowed).toHaveLength(1)
    expect(allowed[0]!.azimuth).toBeGreaterThan(88)
    expect(allowed[0]!.azimuth).toBeLessThan(100)
  })

  test('designOrbit: user-specified LEO / polar / SSO orbits inject at perigee from Canso', () => {
    const cases = [
      { perigeeAltitude: 450, apogeeAltitude: 700, inclination: 51.6 },
      { perigeeAltitude: 550, apogeeAltitude: 900, inclination: 90 },
      { perigeeAltitude: 500, apogeeAltitude: 800, inclination: MISSION.inclination },
    ]
    for (const c of cases) {
      const orbit = engine.designOrbit({ site: NOVA_SCOTIA, vehicle: SPECTRUM, epoch: SEASON, raan: 30, ...c })
      expect(perigeeAltitude(orbit)).toBeCloseTo(c.perigeeAltitude, 6)
      const [w] = engine.calculateLaunchWindows(mission(orbit))
      expect(w).toBeDefined()
      expect(w!.insertion.altitude).toBeCloseTo(c.perigeeAltitude, 0)
      // The generated as-flown orbit starts right where the Canso ascent ends
      const s = propagate(w!.orbit, w!.insertion.time)
      expect(calculateDistance(s.latitude, s.longitude, w!.insertion.latitude, w!.insertion.longitude)).toBeLessThan(5)
    }
    const circ = engine.designOrbit({ site: NOVA_SCOTIA, epoch: SEASON, raan: 0, perigeeAltitude: 600, apogeeAltitude: 600, inclination: 90 })
    expect(circ.eccentricity).toBe(0)
  })

  test('Atlantic climatology: winters are windier than summers', () => {
    const wind = (month: number) =>
      Array.from({ length: 28 }, (_, d) => climatologicalWeather(NOVA_SCOTIA, new Date(Date.UTC(2027, month, 1 + d, 15))).windSpeedKt).reduce((a, b) => a + b)
    expect(wind(0)).toBeGreaterThan(wind(6) * 1.3)
  })
})

describe('weather', () => {
  const calm: HourlyWeather = { time: START, windSpeedKt: 8, windGustKt: 12, cloudCover: 20, precipitationProbability: 5, cape: 50, weatherCode: 1 }

  test('calm conditions are GO (green)', () => {
    expect(assessWeather(calm, 'forecast').risk).toBe('low')
  })

  test('thunderstorms are NO-GO (red)', () => {
    const a = assessWeather({ ...calm, weatherCode: 95, cape: 2500 }, 'forecast')
    expect(a.risk).toBe('high')
    expect(a.factors.find((f) => f.name === 'Lightning potential')!.status).toBe('nogo')
  })

  test('strong wind raises risk', () => {
    expect(assessWeather({ ...calm, windSpeedKt: 34, windGustKt: 45 }, 'forecast').risk).toBe('high')
  })

  test('forecast is used when available, climatology otherwise', () => {
    expect(weatherAt(KSC, START, [calm]).source).toBe('forecast')
    expect(weatherAt(KSC, days(3), [calm]).source).toBe('climatology')
  })

  test('climatology: Florida summer afternoons are stormier than winter mornings', () => {
    let summer = 0
    let winter = 0
    for (let d = 0; d < 30; d++) {
      summer += assessWeather(climatologicalWeather(KSC, new Date(Date.UTC(2026, 6, 1 + d, 20))), 'climatology').violationProbability
      winter += assessWeather(climatologicalWeather(KSC, new Date(Date.UTC(2026, 0, 1 + d, 14))), 'climatology').violationProbability
    }
    expect(summer).toBeGreaterThan(winter * 2)
  })
})

describe('geometry helpers', () => {
  test('visibility radius grows with altitude', () => {
    expect(visibilityRadius(100, 5)).toBeGreaterThan(visibilityRadius(20, 5))
    expect(visibilityRadius(200, 5)).toBeGreaterThan(900)
    expect(visibilityRadius(200, 5)).toBeLessThan(1300)
  })

  test('destination point round-trips with haversine distance', () => {
    const p = destinationPoint(28.5, -80.6, 45, 1000)
    expect(calculateDistance(28.5, -80.6, p.latitude, p.longitude)).toBeCloseTo(1000, -1)
  })

  test('corridor margin handles wrap-around corridors', () => {
    expect(corridorMargin(0, GUIANA)).toBeGreaterThan(0)
    expect(corridorMargin(120, GUIANA)).toBe(-1)
  })
})

describe('math utilities', () => {
  test('angle conversions', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90)
    expect(normalizeAngle(-30)).toBe(330)
    expect(normalizeAngle(720)).toBe(0)
  })

  test("Kepler's equation", () => {
    const E = solveKepler(30, 0.1)
    expect(degToRad(E) - 0.1 * Math.sin(degToRad(E))).toBeCloseTo(degToRad(30), 10)
    expect(solveKepler(90, 0)).toBeCloseTo(90, 10)
  })

  test('circular orbit state vector magnitude', () => {
    const s = keplerianToCartesian(6778, 0, 51.6, 30, 0, 45)
    expect(Math.hypot(s.x, s.y, s.z)).toBeCloseTo(6778, 6)
    expect(Math.hypot(s.vx, s.vy, s.vz)).toBeCloseTo(Math.sqrt(398600.4418 / 6778), 6)
  })
})

describe('input validation', () => {
  test('schema rejects reversed date ranges', () => {
    expect(CalculationInputSchema.safeParse({ ...ISS, dateRange: { start: days(2), end: days(1) } }).success).toBe(false)
  })

  test('schema accepts a valid mission and rejects hyperbolic orbits', () => {
    expect(CalculationInputSchema.safeParse(ISS).success).toBe(true)
    expect(CalculationInputSchema.safeParse({ ...ISS, orbit: { ...ISS.orbit, eccentricity: 1.2 } }).success).toBe(false)
  })

  test('TLE elements are accepted by the schema', () => {
    expect(CalculationInputSchema.safeParse({ ...ISS, orbit: tleToElements((parseTle(TLES.SAPPHIRE) as { ok: true; tle: never }).tle) }).success).toBe(true)
  })
})

describe('orbit traffic', () => {
  const gp = (id: number, revPerDay: number, ecc: number, inc: number) => ({
    OBJECT_NAME: `OBJ ${id}`,
    NORAD_CAT_ID: id,
    EPOCH: '2026-10-01T12:00:00.000000',
    MEAN_MOTION: revPerDay,
    ECCENTRICITY: ecc,
    INCLINATION: inc,
  })
  // Mean motion (rev/day) of a circular orbit at an altitude
  const rev = (alt: number) => 86_400 / orbitalPeriod(alt)

  test('mean motion converts back to the circular-orbit radius', () => {
    expect(semiMajorAxisFromMeanMotion(rev(420)) - 6378.137).toBeCloseTo(420, 6)
  })

  test('parses GP records as UTC and rejects malformed ones', () => {
    const o = parseGpRecord(gp(1, rev(500), 0.01, 51.6))!
    expect(o.epoch.toISOString()).toBe('2026-10-01T12:00:00.000Z')
    expect(o.perigee).toBeLessThan(500)
    expect(o.apogee).toBeGreaterThan(500)
    expect(parseGpRecord({ ...gp(2, rev(500), 0, 51.6), MEAN_MOTION: '15.1' })).toBeNull()
    expect(parseGpRecord({ ...gp(3, rev(500), 1.2, 51.6) })).toBeNull()
    expect(parseGpRecord(null)).toBeNull()
  })

  test('counts shell and inclination overlaps and ranks by altitude', () => {
    const objects = [
      gp(10, rev(420), 0, 51.6), // in shell
      gp(11, rev(440), 0, 52.5), // in shell, edge of inclination band
      gp(12, rev(450), 0, 51.6), // 30 km above: outside ±25
      gp(13, rev(420), 0, 53.7), // inclination 2.06° off
      gp(14, rev(800), 0.05, 51.6), // eccentric: perigee dips into the shell
      gp(15, rev(410), 0, 51.0),
    ].map((r) => parseGpRecord(r)!)
    const perigee14 = objects[4]!.perigee
    expect(perigee14).toBeLessThan(445)

    const t = orbitTraffic(objects, { altitude: 420, inclination: 51.64 })
    expect(t.total).toBe(6)
    expect(t.matches).toBe(4)
    expect(t.closest.map((o) => o.noradId)).toEqual([10, 15, 11, 14])
    expect(t.medianEpoch?.toISOString()).toBe('2026-10-01T12:00:00.000Z')
    expect(orbitTraffic(objects, { altitude: 420, inclination: 51.64 }, { limit: 2 }).closest).toHaveLength(2)
  })
})

describe('conjunction screen', () => {
  const insertion = new Date('2026-10-05T12:00:00Z')
  const orbit = { altitude: 500, inclination: 51.6 }
  const window = { raan: 40, branch: 'ascending' as const, insertion: { time: insertion, latitude: 0 } }
  // Circular object in the payload's plane at insertion, `phase` degrees ahead along-track
  const omm = (name: string, id: number, phase: number, altitude = orbit.altitude) => ({
    OBJECT_NAME: name,
    OBJECT_ID: `2026-001${String.fromCharCode(64 + (id % 26) + 1)}`,
    EPOCH: insertion.toISOString().replace('Z', ''),
    MEAN_MOTION: 86_400 / orbitalPeriod(altitude),
    ECCENTRICITY: 0.0001,
    INCLINATION: orbit.inclination,
    RA_OF_ASC_NODE: window.raan,
    ARG_OF_PERICENTER: 0,
    MEAN_ANOMALY: phase,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: id,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 1,
    BSTAR: 0,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  })

  test('pre-filters to objects within ±50 km of the target altitude', () => {
    const objects = prepareScreeningObjects([omm('NEAR', 1, 90, 540), omm('FAR', 2, 90, 600), { junk: true }], orbit.altitude)
    expect(objects.map((o) => o.name)).toEqual(['NEAR'])
  })

  test('blocks a window when an object passes within 25 km', () => {
    const result = screenWindow(prepareScreeningObjects([omm('SAT A', 1, 0), omm('SAT B', 2, 180)], orbit.altitude), orbit, window)
    expect(result.blocked).toBe(true)
    expect(result.reason).toMatch(/^collision risk: \d+\.\d km from SAT A$/)
    expect(result.closest!.distanceKm).toBeLessThan(25)
  })

  test('uses the 200 km limit for ISS and Tiangong (CSS) modules only', () => {
    // ~1° ahead along-track ≈ 120 km
    const station = screenWindow(prepareScreeningObjects([omm('CSS (TIANHE)', 3, 1)], orbit.altitude), orbit, window)
    expect(station.blocked).toBe(true)
    expect(station.reason).toContain('CSS (TIANHE)')
    expect(station.closest!.thresholdKm).toBe(200)

    const other = screenWindow(prepareScreeningObjects([omm('ISS OBJECT YM', 4, 180)], orbit.altitude), orbit, window)
    expect(other.blocked).toBe(false)
    expect(other.reason).toBeUndefined()
    expect(other.closest!.thresholdKm).toBe(25)
    expect(other.closest!.distanceKm).toBeGreaterThan(1000)
  })
})

describe('target orbit ranges and fixed planes', () => {
  test('a and e come from perigee and apogee', () => {
    const { semiMajorAxis, eccentricity } = shapeFromApsides(600, 800)
    expect(semiMajorAxis).toBeCloseTo(6378.137 + (600 + 800) / 2, 9)
    expect(eccentricity).toBeCloseTo((800 - 600) / (2 * 6378.137 + 600 + 800), 12)
    expect(shapeFromApsides(690, 690).eccentricity).toBe(0)
  })

  test('J2 drift and SSO inclination use the eccentricity, not just a', () => {
    const { semiMajorAxis: a, eccentricity: e } = shapeFromApsides(500, 900)
    expect(e).toBeGreaterThan(0.02)
    // p = a(1 − e²) shrinks with e, so the node regresses faster and SSO needs slightly less inclination (|cos i| smaller)
    expect(Math.abs(secularRates({ semiMajorAxis: a, eccentricity: e, inclination: 51.6 }).raanRate)).toBeGreaterThan(
      Math.abs(secularRates({ semiMajorAxis: a, eccentricity: 0, inclination: 51.6 }).raanRate)
    )
    expect(sunSynchronousInclinationFor(a, e)).toBeLessThan(sunSynchronousInclinationFor(a, 0))
  })

  test('apogee ceilings per family', () => {
    expect(maxApogeeAltitude('LEO', 500)).toBe(2000)
    expect(maxApogeeAltitude('POLAR', 900)).toBe(2000)
    expect(maxApogeeAltitude('SSO', 690)).toBe(890)
    expect(ORBIT_ALTITUDE.SSO).toMatchObject({ defaultKm: 690, min: 500, max: 800 })
  })

  test('SSO plane crosses the equator southbound at 10:00 mean solar time', () => {
    const t = new Date('2027-12-01T00:00:00Z')
    const el = { ...shapeFromApsides(690, 690), inclination: 98.15, epoch: t, raan: raanForLtan(ORBIT_PLANE.ssoDescendingNodeHours + 12, t), argOfPerigee: 0, meanAnomaly: 0 }
    expect(ltanAt(el)).toBeCloseTo(22, 9)
    expect(el.raan).toBeCloseTo(normalizeAngle(280.46 + 0.9856474 * (t.getTime() / 86_400_000 + 2440587.5 - 2451545) + 150), 9)
  })
})

describe('LEO / polar plane chosen for a 09:30 local insertion', () => {
  const engine = new OrbitalEngine()
  const site = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA
  const vehicle = COMMON_VEHICLES.SPECTRUM
  const tz = site.timeZone

  test('local time conversion follows Halifax daylight saving', () => {
    expect(zonedTimeToUtc('2026-10-04', '09:30', tz).toISOString()).toBe('2026-10-04T12:30:00.000Z') // ADT, UTC−3
    expect(zonedTimeToUtc('2027-12-01', '09:30', tz).toISOString()).toBe('2027-12-01T13:30:00.000Z') // AST, UTC−4
    expect(zonedDate(new Date('2027-12-01T00:00:00Z'), tz)).toBe('2027-11-30')
  })

  const cases = [
    { family: 'LEO', inclination: site.latitude, perigee: 500 },
    { family: 'LEO', inclination: 55, perigee: 500 },
    { family: 'POLAR', inclination: 89, perigee: 600 },
  ] as const
  for (const date of ['2026-10-04', '2027-12-01']) {
    for (const c of cases) {
      test(`${date} ${c.family} ${c.inclination.toFixed(1)}°: first insertion within 1 min of ${ORBIT_PLANE.insertionLocalTime[c.family]}`, () => {
        const epoch = new Date(`${date}T00:00:00Z`)
        const insertionTime = zonedTimeToUtc(date, ORBIT_PLANE.insertionLocalTime[c.family], tz)
        const orbit = engine.designOrbitForInsertion({
          site,
          vehicle,
          epoch,
          perigeeAltitude: c.perigee,
          apogeeAltitude: c.perigee,
          inclination: c.inclination,
          insertionTime,
        })
        const input = { orbit, launchSite: site, vehicle, dateRange: { start: epoch, end: new Date(epoch.getTime() + 3 * 86_400_000) } }
        expect(engine.analyzeMission(input).feasible).toBe(true)
        const first = engine.calculateLaunchWindows(input)[0]!
        expect(Math.abs(first.insertion.time.getTime() - insertionTime.getTime())).toBeLessThan(60_000)
        expect(corridorMargin(first.azimuth, site)).toBeGreaterThanOrEqual(0)
        expect((first.insertion.time.getTime() - first.optimal.getTime()) / 1000).toBeCloseTo(vehicle.ascentDuration, 0)
      })
    }
  }
})
