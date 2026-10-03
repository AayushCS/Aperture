
// Prints the next launch windows for each orbit, plus a cost-of-delay example.
// Run with:  node demo.js
import { findWindows, ORBITS, SITE } from "./launchWindows.js";
import { delayCost } from "./delayCost.js";

const fmtTime = (d) => d.toLocaleTimeString("en-CA", { timeZone: SITE.timeZone, hour: "2-digit", minute: "2-digit" });

console.log(`Launch windows from ${SITE.name} (${SITE.lat}°N, ${Math.abs(SITE.lon)}°W)`);
console.log(`Rules: launch hours ${SITE.rules.allowedHours?.join(":00–") ?? "none"}:00, ` +
  `direction limit ${SITE.rules.allowedAzimuth ? SITE.rules.allowedAzimuth.join("°–") + "°" : "not set (unconfirmed)"}\n`);

const cases = [
  ["LEO", { raan: 0 }, "Ω = 0° is an example value"],
  ["POLAR", { raan: 0 }, "Ω = 0° is an example value"],
  ["SSO", {}, "Ω from a 10:30am mean-solar-time crossing"],
  ["SSO", { crossingHours: 10 }, "same orbit, 10:00am crossing instead"],
  ["CUSTOM", { inclination: 30, raan: 0 }, "a 30° orbit, to show an unreachable case"],
];

for (const [key, opts, note] of cases) {
  const r = findWindows(key, { ...opts, count: 3 });
  const label = ORBITS[key]?.name ?? "Custom orbit";
  console.log(`${label} (${r.inclination}°, ${r.altitudeKm} km) — ${note}`);

  if (!r.reachable) {
    console.log(`   Not reachable: ${r.reason}\n`);
    continue;
  }
  if (r.windows.length === 0) {
    console.log("   No windows found.\n");
    continue;
  }

  console.log(`   Fly ${r.groundAzimuth.toFixed(1)}° (${r.heading}); Earth's spin adds ${r.rotationBoostMs.toFixed(0)} m/s` +
    (r.inclination > 90 ? `; sun-synchronous at this altitude: ${r.sunSynchronous ? "yes" : "no"}` : ""));
  for (const w of r.windows) {
    const status = w.allowed ? "ALLOWED" : `BLOCKED: ${w.blockedReasons.join("; ")}`;
    console.log(`   ${w.local}  (window ${fmtTime(w.opens)}–${fmtTime(w.closes)})  ${status}`);
  }
  console.log();
}

const c = delayCost({ inclination: 98.1, altitudeKm: 690, minutesLate: 5, satelliteMassKg: 100 });
console.log("Cost of a 5-minute delay for a 100 kg satellite going to SSO:");
console.log(`   orbit twisted ${c.twistDeg.toFixed(2)}° → needs ${c.deltaV.toFixed(0)} m/s → ` +
  `${c.fuelKg.toFixed(1)} kg of fuel (${(c.fuelShare * 100).toFixed(1)}% of the satellite) ≈ $${Math.round(c.launchCostUsd).toLocaleString("en-CA")} to launch`);
