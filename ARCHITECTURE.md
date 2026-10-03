# Architecture

```
packages/orbital-core      Pure TypeScript engine (only dependency: zod)
  src/constants.ts         WGS-84, μ, J2, Earth rotation
  src/math.ts              Angles, haversine, Kepler solver, seeded RNG
  src/astro.ts             Julian date, GMST, solar position, sub-solar point
  src/orbit.ts             Period, J2 precession, SSO inclination, plane-crossing
                           geometry, next-crossing solver, ground tracks
  src/trajectory.ts        Ascent profile, lighting, viewing footprints
  src/weather.ts           Launch-commit assessment, climatology model
  src/calculations.ts      OrbitalEngine: analyzeMission, calculateLaunchWindows
  test/engine.test.ts      Physics + behaviour tests (bun test)

apps/launch-watcher        React 18 + Vite + Tailwind
  src/store/mission.ts     Zustand mission profile (persisted)
  src/hooks/               useMissionPlan (engine ⨯ profile ⨯ forecast), useForecast, useNow
  src/lib/                 Formatting, d3-geo helpers (terminator, circles, tracks)
  src/components/          CountdownTimer, WeatherPanel, ViewingMap (SVG), OrbitGlobe (canvas), WindowTable
  src/pages/               Dashboard, LaunchPlanner, OrbitVisualizer
```

## Launch window algorithm

1. **Reachability.** A direct ascent from latitude φ reaches inclination *i* only if |cos *i*| ≤ cos φ.
2. **Plane geometry.** For each pass (ascending / descending) the inertial azimuth is β = asin(cos *i* / cos φ), and the site's argument of latitude is *u* = asin(sin φ / sin *i*). Converting to the node offset gives where the site must sit relative to the ascending node. The flown azimuth subtracts Earth's surface velocity.
3. **Corridor filter.** Passes outside the site's range-safety azimuth corridors are dropped, e.g. SSO from KSC.
4. **Crossing solver.** The site's right ascension (GMST + longitude) must equal RAAN + node offset. RAAN moves with J2 precession (LEO/polar) or tracks the Sun's right ascension (SSO, from LTAN). The engine solves the crossing directly and refines it with one Newton step, so there is no brute-force time scan. Successive crossings are one synodic day apart, about 23 h 56 min ± drift.
5. **Window.** It spans optimal ± (RAAN tolerance ÷ Earth rotation rate).
6. **Assessment.** Each window gets:
   - an ascent trajectory, using vehicle ascent duration to find the insertion time and point
   - lighting, including whether the plume is sunlit against a dark sky
   - viewing footprints from elevation-angle geometry
   - weather
7. **Constraints and score.** Daylight, minimum sun elevation and maximum weather risk filters are applied. The score is 50% weather, 20% rotational performance, 15% corridor margin and 15% public viewing.

## Weather

`assessWeather` maps each launch-commit factor (wind, gusts, lightning/CAPE, precipitation, cloud) to a violation probability with smooth ramps around its limit. It then combines them as 1 − ∏(1 − pᵢ):

| Combined probability | Risk | Indicator |
| --- | --- | --- |
| < 20% | low | Green |
| < 45% | medium | Yellow |
| ≥ 45% | high | Red |

Forecast samples are matched within ±90 min. Otherwise `climatologicalWeather` produces a deterministic estimate from monthly profiles per climate zone, with a diurnal convective peak and date-seeded variability. Results are therefore reproducible and testable.

## Frontend data flow

```
useMissionStore (persisted) ─┐
useForecast (react-query) ───┼─► useMissionPlan ─► analysis, windows, next, focus ─► pages
orbitalEngine ───────────────┘        (useMemo)
```

Vite and TypeScript alias `@aperture/orbital-core` to the engine source, so there is no build step during development. Coarse land geometry (110m) ships with the app. The detailed 50m layer used by the regional map is lazy-loaded.
