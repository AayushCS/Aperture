# Aperture

Launch window planning from **Spaceport Nova Scotia** (Canso, NS) into a **single target orbit defined by a TLE** — an orbital mechanics engine plus a "Launch Watch" dashboard.

- **Orbital Architect** (`packages/orbital-core`): parses/validates TLEs, propagates one elliptical orbit (two-body + J2 secular), solves for the instants when Earth's rotation carries the pad through that orbit's plane, places the insertion point on the ellipse, then applies vehicle limits, the over-ocean azimuth corridor, lighting and weather, and scores each window.
- **Launch Watcher** (`apps/launch-watcher`): countdown, Green/Yellow/Red weather go/no-go, ascent viewing map, TLE editor, interactive 3D-orbit globe, and a catalog of Canadian satellites.

The default mission is **APERTURE-1**, a hypothetical 500 × 800 km sun-synchronous orbit (10:30 descending node, epoch 1 Dec 2027 — the spaceport's targeted first orbital season). It is not a real object; catalog number 99901 is in the unassigned range.

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

- **Launch Watch** (`/`) — countdown, weather at T-0, mission-orbit / site / catalog widgets (all clickable), ascent viewing map and upcoming windows.
- **Window Planner** (`/planner`) — the TLE is the mission's single source of truth. Paste a TLE (live checksum/field validation), target a catalog satellite's orbit, or edit elements (perigee, apogee, inclination, LTAN/RAAN, argument of perigee, epoch) — edits regenerate the TLE. Orbit class (LEO/POLAR/SSO/MEO/GEO/HEO) is inferred, never chosen. Windows export to CSV; state is saved in `localStorage`.
- **Orbit** (`/orbit`) — drag/zoom/fullscreen globe with the orbit drawn as a 3D ellipse, configurable layers and number of ground-track revolutions (one orbit; later revolutions fade because Earth turns under it), Canadian satellites at their altitude (click to inspect), and an in-plane ellipse diagram.

Weather comes from the [Open-Meteo](https://open-meteo.com/) 16-day hourly forecast (free, no key; only the public site coordinates are sent). Beyond the forecast horizon, or if the request fails, a deterministic per-site climatology model is used. The data source is always labelled in the UI.

## Engine API

```ts
import { orbitalEngine, orbitFromTle, COMMON_LAUNCH_SITES, COMMON_VEHICLES, HYPOTHETICAL_MISSION_TLE } from '@aperture/orbital-core'

const input = {
  orbit: orbitFromTle(HYPOTHETICAL_MISSION_TLE),   // or any TLE text; throws with all validation errors
  launchSite: COMMON_LAUNCH_SITES.SPACEPORT_NOVA_SCOTIA,
  vehicle: COMMON_VEHICLES.SPECTRUM,
  dateRange: { start: new Date('2027-12-01'), end: new Date('2027-12-15') },
  constraints: { maxWeatherRisk: 'medium' },
}

const analysis = orbitalEngine.analyzeMission(input)  // class, perigee/apogee, J2 rates, LTAN, azimuths, issues
const windows = orbitalEngine.calculateLaunchWindows(input)
// windows[i]: start / optimal / end, azimuth, insertion (altitude, true anomaly), as-flown `orbit` elements,
//             weather, lighting, trajectory, visibilityRegions, quality + scoreBreakdown
```

TLE helpers: `parseTle` (non-throwing, returns errors), `formatTle` / `tleToText` (checksums), `tleToElements` / `elementsToTle` (Kozai ↔ Brouwer). Propagation: `propagate`, `groundTrack`, `orbitRing`. `CalculationInputSchema` (Zod) validates untrusted input.

## Model and limits

One elliptical orbit from TLE mean elements, propagated with two-body motion plus J2 secular rates (node, perigee, mean anomaly) — not full SGP4, so catalog positions are indicative and drift as TLEs age. IAU-1982 GMST; low-precision solar ephemeris (~0.01°). Liftoff leads the pad's plane crossing so that insertion (after Earth turns during ascent) lands in the target plane. Window width comes from an allowable RAAN error (±2° LEO, ±1° polar/HEO, ±0.5° SSO). The ascent is a smooth great-circle profile; MEO/GEO/HEO are flagged since real missions use transfer orbits.

Spaceport Nova Scotia's corridor (88°–200°, i.e. roughly 45°–98° inclinations over open ocean), vehicle figures and North-Atlantic climatology are representative, not official. Orbital operations are assumed from October 2027; earlier searches are flagged as hypothetical. Planning and education only, **not operational use**.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design details.

## License

MIT
