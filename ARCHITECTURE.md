# Architecture

```
packages/orbital-core      Pure TypeScript engine (only dependency: zod)
  src/constants.ts         WGS-84, WGS-72 (TLE), μ, J2, Earth rotation
  src/tle.ts               TLE parse/validate/format, checksums, Kozai ↔ Brouwer
  src/elements.ts          Elliptical elements: J2 secular rates, propagate, ground
                           track, 3D orbit ring, class inference, LTAN
  src/math.ts              Angles, haversine, Kepler solver, seeded RNG
  src/astro.ts             Julian date, GMST, solar position, sub-solar point
  src/orbit.ts             Reachability, plane-crossing geometry, next-crossing
                           solver, circular-orbit helpers
  src/trajectory.ts        Ascent profile, lighting, viewing footprints
  src/weather.ts           Launch-commit assessment, climatology model
  src/calculations.ts      OrbitalEngine: analyzeMission, calculateLaunchWindows
  test/engine.test.ts      Physics + behaviour tests (bun test)

apps/launch-watcher        React 18 + Vite + Tailwind
  src/store/mission.ts     Zustand: mission (orbit family + apsides + inclination/RAAN/LTAN), globe settings
  src/hooks/               useMissionPlan (engine ⨯ profile ⨯ forecast), useForecast, useNow
  src/lib/                 Formatting, d3-geo helpers (terminator, circles, tracks)
  src/components/          OrbitForm (LEO/Polar/SSO), TleDialog/TleView (generated TLE),
                           OrbitGlobe (canvas, 3D ring), OrbitBackdrop, EllipseDiagram,
                           SiteWidget, CountdownTimer, WeatherPanel, ViewingMap, WindowTable
  src/pages/               Dashboard, LaunchPlanner, OrbitVisualizer
```

## Launch window algorithm

1. **Reachability.** A direct ascent from latitude φ reaches inclination *i* only if |cos *i*| ≤ cos φ.
2. **Plane geometry.** For each pass (ascending / descending) the inertial azimuth is β = asin(cos *i* / cos φ), and the site's argument of latitude is *u* = asin(sin φ / sin *i*). Converting to the node offset gives where the site must sit relative to the ascending node. The flown azimuth subtracts Earth's surface velocity.
3. **Corridor filter.** Passes outside the site's range-safety azimuth corridors are dropped, e.g. the northbound pass from Nova Scotia.
4. **Crossing solver.** The site's right ascension (GMST + longitude) must equal RAAN + node offset. RAAN is propagated from the TLE epoch with the J2 secular rate (for an SSO that rate equals the Sun's, so the LTAN holds). The engine solves the crossing directly and refines it with one Newton step, so there is no brute-force time scan. Successive crossings are one synodic day apart, about 23 h 56 min ± drift.
5. **Insertion on the ellipse.** The ascent's end point gives the argument of latitude u, so the true anomaly is ν = u − ω and the insertion altitude is r(ν). The trajectory is re-solved for that altitude. Liftoff is moved earlier by the plane offset Earth's rotation causes during ascent, so the as-flown plane (`window.orbit`) matches the target.
6. **Window.** It spans optimal ± (RAAN tolerance ÷ Earth rotation rate).
7. **Assessment.** Each window gets:
   - an ascent trajectory, using vehicle ascent duration to find the insertion time and point
   - lighting, including whether the plume is sunlit against a dark sky
   - viewing footprints from elevation-angle geometry
   - weather
8. **Constraints and score.** Daylight, minimum sun elevation and maximum weather risk filters are applied. The score is 50% weather, 20% rotational performance, 15% corridor margin and 15% public viewing.

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
