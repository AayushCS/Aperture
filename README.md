# Aperture

Launch window planning for LEO, polar and sun-synchronous missions — an orbital mechanics engine plus a public "Launch Watch" dashboard.

- **Orbital Architect** (`packages/orbital-core`): solves for the instants when Earth's rotation carries a launch site through the target orbital plane, then applies vehicle limits, range-safety azimuth corridors, lighting and weather constraints, and scores each window.
- **Launch Watcher** (`apps/launch-watcher`): live countdown, Green/Yellow/Red weather go/no-go, ascent viewing map, window planner and an animated orbit globe.

## Quick start

Requires [Bun](https://bun.sh) ≥ 1.1.

```bash
bash install.sh     # installs both packages
bun run dev         # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `bun run dev` | Vite dev server; the app consumes the engine from source with HMR |
| `bun run test` | Engine test suite (`bun test`) |
| `bun run type-check` | Strict TypeScript for engine and app |
| `bun run build` | Engine library (ESM + CJS + `.d.ts`) and production app bundle |
| `bun run check` | All of the above |

## Using the app

- **Launch Watch** (`/`) — countdown to the next window (switches to "closes in" while the window is open), weather at T-0 against launch-commit criteria, a map of the ascent ground path with viewing zones, and the upcoming windows.
- **Window Planner** (`/planner`) — edit the mission (orbit family, altitude, inclination, RAAN or LTAN, site, vehicle, date span, constraints). Results recalculate instantly, feasibility problems are explained, and windows can be exported to CSV. The profile is saved in `localStorage`.
- **Orbit** (`/orbit`) — orthographic globe showing ascent, insertion and the first three orbits of ground track, with day/night terminator and coverage footprint.

Weather comes from the [Open-Meteo](https://open-meteo.com/) 16-day hourly forecast (free, no key; only the public site coordinates are sent). Beyond the forecast horizon, or if the request fails, a deterministic per-site climatology model is used. The data source is always labelled in the UI.

## Engine API

```ts
import { orbitalEngine, COMMON_LAUNCH_SITES, COMMON_VEHICLES } from '@aperture/orbital-core'

const input = {
  orbit: { type: 'LEO', altitude: 420, inclination: 51.64, raan: 120, raanEpoch: new Date('2026-01-01') },
  launchSite: COMMON_LAUNCH_SITES.KSC,
  vehicle: COMMON_VEHICLES.FALCON_9,
  dateRange: { start: new Date(), end: new Date(Date.now() + 7 * 86_400_000) },
  constraints: { maxWeatherRisk: 'medium' },
  // weather: HourlyWeather[]  — optional forecast; climatology otherwise
} as const

const analysis = orbitalEngine.analyzeMission(input)  // feasibility issues, period, J2 drift, azimuths
const windows = orbitalEngine.calculateLaunchWindows(input)
// windows[i]: start / optimal / end, azimuth, branch, weather (factors + risk),
//             lighting, insertion point, trajectory, visibilityRegions, quality + scoreBreakdown
```

For SSO missions set `orbit.ltan` (local time of ascending node, hours); the plane is tied to the Sun's right ascension. `CalculationInputSchema` (Zod) validates untrusted input.

## Model and limits

Circular orbits; two-body motion with J2 secular nodal precession; IAU-1982 GMST; low-precision solar ephemeris (~0.01°). Windows are centred on the in-plane time with width set by an allowable RAAN error (default ±2° LEO, ±1° polar, ±0.5° SSO). The ascent is a smooth great-circle profile, not a simulated trajectory, and the azimuth corridors and weather limits are representative, not official range rules. Results are for planning and education, **not operational use**.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design details.

## License

MIT
