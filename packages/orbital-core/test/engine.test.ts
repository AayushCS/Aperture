import { describe, expect, test } from 'bun:test'
import {
  COMMON_LAUNCH_SITES as SITES,
  COMMON_VEHICLES as VEHICLES,
  OrbitalEngine,
  CalculationInputSchema,
  assessWeather,
  calculateDistance,
  climatologicalWeather,
  corridorMargin,
  degToRad,
  destinationPoint,
  gmst,
  groundTrack,
  groundTrackFromPoint,
  keplerianToCartesian,
  localSolarTime,
  nextWindow,
  nodalPrecession,
  normalizeAngle,
  orbitalPeriod,
  planeGeometry,
  radToDeg,
  solveKepler,
  sunElevation,
  sunPosition,
  sunSynchronousInclination,
  visibilityRadius,
  weatherAt,
  type CalculationInput,
  type HourlyWeather,
} from '../src'

const engine = new OrbitalEngine()
const START = new Date('2026-03-01T00:00:00Z')
const days = (n: number) => new Date(START.getTime() + n * 86_400_000)

function input(overrides: Partial<CalculationInput> & { orbit: CalculationInput['orbit'] }): CalculationInput {
  return {
    vehicle: VEHICLES.FALCON_9,
    launchSite: SITES.KSC,
    dateRange: { start: START, end: days(7) },
    ...overrides,
  }
}

const ISS = input({ orbit: { type: 'LEO', altitude: 420, inclination: 51.64, raan: 120 } })

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
    const { latitude, longitude } = SITES.KSC
    expect(sunElevation(new Date('2026-06-21T17:25:00Z'), latitude, longitude)).toBeGreaterThan(80)
    expect(sunElevation(new Date('2026-06-21T05:25:00Z'), latitude, longitude)).toBeLessThan(-30)
  })

  test('local solar time follows longitude', () => {
    expect(localSolarTime(new Date('2026-01-01T12:00:00Z'), 0)).toBeCloseTo(12, 6)
    expect(localSolarTime(new Date('2026-01-01T12:00:00Z'), -90)).toBeCloseTo(6, 6)
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
    // An SSO plane precesses at the Sun's mean rate (~0.9856°/day)
    expect(nodalPrecession(700, sunSynchronousInclination(700))).toBeCloseTo(0.9856, 3)
  })

  test('launch azimuth from KSC to ISS inclination ≈ 45° inertial', () => {
    const [ascending, descending] = planeGeometry(SITES.KSC.latitude, 51.64, 420)
    expect(ascending!.inertialAzimuth).toBeCloseTo(44.9, 0)
    expect(descending!.inertialAzimuth).toBeCloseTo(135.1, 0)
    // Removing Earth's eastward surface velocity turns the Earth-relative azimuth slightly north
    expect(ascending!.azimuth).toBeCloseTo(42.7, 0)
    expect(descending!.azimuth).toBeCloseTo(137.3, 0)
  })

  test('inclination below site latitude is unreachable', () => {
    expect(planeGeometry(SITES.KSC.latitude, 20, 400)).toHaveLength(0)
  })

  test('ground track latitude never exceeds inclination', () => {
    const track = groundTrack({ altitudeKm: 420, inclinationDeg: 51.64, raan: 0, argumentOfLatitude: 0, epoch: START, durationSec: 6000 })
    const maxLat = Math.max(...track.map((p) => Math.abs(p.latitude)))
    expect(maxLat).toBeLessThanOrEqual(51.64 + 1e-6)
    expect(maxLat).toBeGreaterThan(51)
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

  test('at the optimal time the pad lies in the target plane', () => {
    const [w] = engine.calculateLaunchWindows(ISS)
    // Site right ascension minus node RAAN should equal the in-plane node offset
    const geometry = planeGeometry(SITES.KSC.latitude, 51.64, 420)[0]!
    const raanAtLiftoff = 120 + (nodalPrecession(420, 51.64) * (w!.optimal.getTime() - START.getTime())) / 86_400_000
    const residual = normalizeAngle(gmst(w!.optimal) + SITES.KSC.longitude - raanAtLiftoff - geometry.nodeOffset + 180) - 180
    expect(Math.abs(residual)).toBeLessThan(0.01)
  })

  test('windows never overlap', () => {
    const windows = engine.calculateLaunchWindows(input({ orbit: { type: 'POLAR', altitude: 600, inclination: 90 }, launchSite: SITES.VANDENBERG }))
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.start.getTime()).toBeGreaterThan(windows[i - 1]!.end.getTime())
    }
  })

  test('SSO from Vandenberg launches south at the same local time every day', () => {
    const windows = engine.calculateLaunchWindows(
      input({ orbit: { type: 'SSO', altitude: 550, inclination: sunSynchronousInclination(550), ltan: 22.5 }, launchSite: SITES.VANDENBERG })
    )
    expect(windows.length).toBe(7)
    const times = windows.map((w) => localSolarTime(w.optimal, SITES.VANDENBERG.longitude))
    for (const t of times) expect(Math.abs(t - times[0]!)).toBeLessThan(0.1)
    for (const w of windows) expect(w.azimuth).toBeGreaterThan(180)
  })

  test('SSO from KSC is rejected by the range-safety corridor', () => {
    const mission = input({ orbit: { type: 'SSO', altitude: 550, inclination: sunSynchronousInclination(550) } })
    const analysis = engine.analyzeMission(mission)
    expect(analysis.feasible).toBe(false)
    expect(analysis.issues.map((i) => i.code)).toContain('AZIMUTH_RESTRICTED')
    expect(engine.calculateLaunchWindows(mission)).toHaveLength(0)
  })

  test('unreachable inclination and vehicle limits are reported', () => {
    expect(engine.analyzeMission(input({ orbit: { type: 'LEO', altitude: 400, inclination: 20 } })).issues[0]!.code).toBe(
      'INCLINATION_UNREACHABLE'
    )
    const electron = engine.analyzeMission(
      input({ orbit: { type: 'LEO', altitude: 1500, inclination: 51.6 }, vehicle: VEHICLES.ELECTRON })
    )
    expect(electron.issues.map((i) => i.code)).toContain('VEHICLE_ALTITUDE')
  })

  test('SSO inclination mismatch produces a warning, not an error', () => {
    const a = engine.analyzeMission(input({ orbit: { type: 'SSO', altitude: 550, inclination: 95 }, launchSite: SITES.VANDENBERG }))
    expect(a.feasible).toBe(true)
    expect(a.issues[0]!.code).toBe('NOT_SUN_SYNCHRONOUS')
  })

  test('vehicle ascent duration sets insertion time and downrange point', () => {
    const [w] = engine.calculateLaunchWindows(ISS)
    expect((w!.insertion.time.getTime() - w!.optimal.getTime()) / 1000).toBe(VEHICLES.FALCON_9.ascentDuration)
    const downrange = calculateDistance(SITES.KSC.latitude, SITES.KSC.longitude, w!.insertion.latitude, w!.insertion.longitude)
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

  test('post-insertion ground track starts at the insertion point', () => {
    for (const mission of [ISS, input({ orbit: { type: 'SSO', altitude: 550, inclination: 97.6 }, launchSite: SITES.VANDENBERG })]) {
      const [w] = engine.calculateLaunchWindows(mission)
      const track = groundTrackFromPoint({
        altitudeKm: mission.orbit.altitude,
        inclinationDeg: mission.orbit.inclination,
        latitude: w!.insertion.latitude,
        longitude: w!.insertion.longitude,
        branch: w!.branch,
        epoch: w!.insertion.time,
        durationSec: 600,
      })
      expect(calculateDistance(track[0]!.latitude, track[0]!.longitude, w!.insertion.latitude, w!.insertion.longitude)).toBeLessThan(5)
    }
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
    expect(weatherAt(SITES.KSC, START, [calm]).source).toBe('forecast')
    expect(weatherAt(SITES.KSC, days(3), [calm]).source).toBe('climatology')
  })

  test('climatology: Florida summer afternoons are stormier than winter mornings', () => {
    let summer = 0
    let winter = 0
    for (let d = 0; d < 30; d++) {
      summer += assessWeather(climatologicalWeather(SITES.KSC, new Date(Date.UTC(2026, 6, 1 + d, 20))), 'climatology').violationProbability
      winter += assessWeather(climatologicalWeather(SITES.KSC, new Date(Date.UTC(2026, 0, 1 + d, 14))), 'climatology').violationProbability
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
    expect(corridorMargin(0, SITES.GUIANA)).toBeGreaterThan(0)
    expect(corridorMargin(120, SITES.GUIANA)).toBe(-1)
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
    const result = CalculationInputSchema.safeParse({ ...ISS, dateRange: { start: days(2), end: days(1) } })
    expect(result.success).toBe(false)
  })

  test('schema accepts a valid mission', () => {
    expect(CalculationInputSchema.safeParse(ISS).success).toBe(true)
  })
})
