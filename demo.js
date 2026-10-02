// Prints the next launch windows for each orbit type.
// Run with:  node demo.js
import { findWindows, ORBITS, SITE } from "./launchWindows.js";

console.log(`Launch windows from ${SITE.name} (${SITE.lat}°N, ${Math.abs(SITE.lon)}°W)\n`);

const settings = {
  LEO: { raan: 0 },    // Ω chosen by the mission; 0° is just an example
  POLAR: { raan: 0 },  // same
  SSO: {},             // Ω worked out from a 10:30am equator crossing
};

for (const [key, opts] of Object.entries(settings)) {
  const r = findWindows(key, { ...opts, count: 3 });
  const o = ORBITS[key];
  console.log(`${o.name} (${o.inclination}°) → fly ${r.azimuth.toFixed(1)}° from north, ${r.windows[0].direction}`);
  for (const w of r.windows) console.log(`   ${w.local}  (${w.utc})`);
  console.log();
}
