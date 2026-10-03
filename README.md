# Aperture

Launch window planning from **Spaceport Nova Scotia** (Canso, NS) into **one target orbit you design** (LEO, polar or sun-synchronous, circular or elliptical). The app outputs that orbit as a single TLE — the orbit you get by launching from Canso — plus a "Launch Watch" dashboard.

- **Orbital Architect** (`packages/orbital-core`): parses/validates TLEs, propagates one elliptical orbit (two-body + J2 secular), solves for the instants when Earth's rotation carries the pad through that orbit's plane, places the insertion point on the ellipse, then applies vehicle limits, the over-ocean azimuth corridor, lighting and weather, and scores each window.
- **Launch Watcher** (`apps/launch-watcher`): LEO / Polar / SSO orbit designer, generated TLE (copy / download), countdown, Green/Yellow/Red weather go/no-go, ascent viewing map and an interactive 3D-orbit globe.

The default mission is **APERTURE-1**, a hypothetical 600 km circular sun-synchronous orbit (10:30 descending node), searched from 1 Dec 2027 — the spaceport's targeted first orbital season. Generated TLEs use catalog number 99901 (unassigned range).

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

- **Launch Watch** (`/`) — countdown, weather at T-0, mission-orbit (opens the TLE), site and orbit-type widgets, ascent viewing map and upcoming windows.
- **Window Planner** (`/planner`) — pick LEO / Polar / Sun-sync. Each starts circular at a default altitude (LEO 500 km, Polar 700 km, SSO 600 km); **Advanced** opens an altitude slider bounded per family (300–1200 / 500–1000 / 500–900 km) and an optional apogee for elliptical orbits. Then set inclination + RAAN (LEO/polar) or local time of the node (SSO; inclination is set automatically). The argument of perigee is placed where the ascent from Canso reaches orbit, so insertion is at perigee. The generated TLE is the as-flown orbit for the selected window (epoch = insertion). Windows export to CSV; state is saved in `localStorage`.
- **Orbit** (`/orbit`) — drag/zoom/fullscreen globe with the orbit drawn as a 3D ellipse, configurable layers and number of ground-track revolutions (one orbit; later revolutions fade because Earth turns under it), and an in-plane ellipse diagram.

Weather comes from the [Open-Meteo](https://open-meteo.com/) 16-day hourly forecast (free, no key; only the public site coordinates are sent). Beyond the forecast horizon, or if the request fails, a deterministic per-site climatology model is used. The data source is always labelled in the UI.

## Engine API

```ts
import { orbitalEngine, orbitFromTle, COMMON_LAUNCH_SITES, COMMON_VEHICLES, HYPOTHETICAL_MISSION_TLE } from '@aperture/orbital-core'

const site = COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA
const orbit = orbitalEngine.designOrbit({            // or orbitFromTle(HYPOTHETICAL_MISSION_TLE)
  site, vehicle: COMMON_VEHICLES.SPECTRUM, epoch: new Date('2027-12-01'),
  perigeeAltitude: 500, apogeeAltitude: 800, inclination: 97.98, raan: 44.3,
})
const input = {
  orbit,
  launchSite: site,
  vehicle: COMMON_VEHICLES.SPECTRUM,
  dateRange: { start: new Date('2027-12-01'), end: new Date('2027-12-15') },
  constraints: { maxWeatherRisk: 'medium' },
}

const analysis = orbitalEngine.analyzeMission(input)  // class, perigee/apogee, J2 rates, LTAN, azimuths, issues
const windows = orbitalEngine.calculateLaunchWindows(input)
// windows[i]: start / optimal / end, azimuth, insertion (altitude, true anomaly), as-flown `orbit`
//             (→ elementsToTle / tleToText for the generated TLE),
//             weather, lighting, trajectory, visibilityRegions, quality + scoreBreakdown
```

TLE helpers: `parseTle` (non-throwing, returns errors), `formatTle` / `tleToText` (checksums), `tleToElements` / `elementsToTle` (Kozai ↔ Brouwer). Propagation: `propagate`, `groundTrack`, `orbitRing`. `CalculationInputSchema` (Zod) validates untrusted input.

## Model and limits

One elliptical orbit from TLE mean elements, propagated with two-body motion plus J2 secular rates (node, perigee, mean anomaly) — not full SGP4, so generated TLEs are planning-grade, not SGP4-fitted. IAU-1982 GMST; low-precision solar ephemeris (~0.01°). Liftoff leads the pad's plane crossing so that insertion (after Earth turns during ascent) lands in the target plane. Window width comes from an allowable RAAN error (±2° LEO, ±1° polar/HEO, ±0.5° SSO). The ascent is a smooth great-circle profile; MEO/GEO/HEO are flagged since real missions use transfer orbits.

Spaceport Nova Scotia's corridor (88°–200°, i.e. roughly 45°–98° inclinations over open ocean), vehicle figures and North-Atlantic climatology are representative, not official. Orbital operations are assumed from October 2027; earlier searches are flagged as hypothetical. Planning and education only, **not operational use**.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design details.

## License

MIT
