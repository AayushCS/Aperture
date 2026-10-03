// Run with:  node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SITE, ORBITS, isReachable, launchAzimuth, groundAzimuth, nodeOffset, gmst,
  localSiderealAngle, targetSiderealAngle, sunRightAscension, findWindows, norm360,
  ssoInclination, isSunSynchronous, geocentricLat, raanDriftPerDay, compassLabel, checkRules,
} from "./launchWindows.js";
import { delayCost, planeAngle } from "./delayCost.js";

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected}, got ${actual}`);
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const START = new Date("2026-10-03T00:00:00Z");
const NO_RULES = { rules: {} };

// ---------- geometry ----------

test("all three presets are reachable from Nova Scotia", () => {
  for (const key of Object.keys(ORBITS)) assert.ok(isReachable(ORBITS[key].inclination), key);
  assert.equal(isReachable(30), false, "a 30° orbit is too flat for a 45.1° site");
});

test("reachability works for southern-hemisphere sites too", () => {
  assert.equal(isReachable(30, -45), false);
  assert.equal(isReachable(98, -45), true);
});

test("launch direction matches the answers table", () => {
  close(launchAzimuth(45.1, SITE.lat, false), 90, 0.01, "LEO due east");
  close(launchAzimuth(90, SITE.lat, true), 180, 0.01, "Polar due south");
  close(launchAzimuth(98.1, SITE.lat, true), 191.5, 0.1, "SSO south-southwest");
});

test("ground heading accounts for Earth's spin", () => {
  close(groundAzimuth(90, SITE.lat, 500), 90, 0.01, "due east stays due east");
  const sso = groundAzimuth(191.5, SITE.lat, 690);
  assert.ok(sso > 191.5 && sso < 196, `SSO turns slightly further west, got ${sso}`);
});

test("node offset Δλ matches the answers table", () => {
  close(nodeOffset(45.1), 90, 0.01, "LEO");
  close(nodeOffset(90), 0, 0.01, "Polar");
  close(nodeOffset(98.1), -8.2, 0.1, "SSO");
});

test("unreachable orbits are rejected, not silently clamped", () => {
  assert.throws(() => launchAzimuth(30, 45.1), /not reachable/);
  assert.throws(() => nodeOffset(30, 45.1), /not reachable/);
});

test("geocentric latitude is slightly smaller than map latitude", () => {
  close(geocentricLat(45.1), 44.908, 0.002, "45.1° geodetic");
});

test("compass labels read correctly", () => {
  assert.equal(compassLabel(90), "E");
  assert.equal(compassLabel(180), "S");
  assert.equal(compassLabel(193), "SSW");
});

// ---------- time ----------

test("Earth rotation angle at J2000 is the known value", () => {
  close(gmst(new Date("2000-01-01T12:00:00Z")), 280.46061837, 1e-6, "GMST at J2000");
});

test("Sun is in the right place on the March equinox", () => {
  assert.ok(angleDiff(sunRightAscension(new Date("2026-03-20T15:00:00Z")), 0) < 1);
});

test("mean and apparent Sun differ by about 10 minutes in early October", () => {
  const d = new Date("2026-10-03T12:00:00Z");
  const minutes = (angleDiff(sunRightAscension(d, "mean"), sunRightAscension(d, "apparent")) / 15) * 60;
  close(minutes, 10.5, 1.5, "equation of time");
});

// ---------- sun-synchronous ----------

test("98.1° is sun-synchronous at about 690 km, not at 500 km", () => {
  close(ssoInclination(690), 98.15, 0.05, "SSO inclination at 690 km");
  assert.equal(isSunSynchronous(98.1, 690), true);
  assert.equal(isSunSynchronous(98.1, 500), false);
});

test("SSO windows land at about the same clock time every day", () => {
  const { windows } = findWindows("SSO", { start: START, count: 3, site: NO_RULES });
  close((windows[1].alignment - windows[0].alignment) / 3600000, 24, 0.05, "SSO gap (hours)");
  const hourAngle = norm360(localSiderealAngle(windows[0].alignment) - sunRightAscension(windows[0].alignment, "mean"));
  close(hourAngle, 345.7, 0.3, "mean-Sun hour angle at SSO launch");
});

// ---------- window finder ----------

test("at each window, the site really is at the target angle", () => {
  for (const key of ["LEO", "POLAR"]) {
    const raan = 120;
    const { windows } = findWindows(key, { raan, start: START, count: 3, site: NO_RULES });
    const o = ORBITS[key];
    const target = targetSiderealAngle(o.inclination, raan, SITE.lat, o.south);
    for (const w of windows) assert.ok(angleDiff(localSiderealAngle(w.alignment), target) < 0.01, key);
  }
});

test("LEO and Polar windows repeat every sidereal day (23h 56m 4s)", () => {
  const { windows } = findWindows("LEO", { raan: 0, start: START, count: 3, site: NO_RULES });
  close((windows[1].alignment - windows[0].alignment) / 1000, 86164.1, 2, "gap (s)");
});

test("LEO is labelled as heading east, not north", () => {
  const r = findWindows("LEO", { raan: 0, start: START, count: 1 });
  assert.equal(r.heading, "E");
  close(r.rotationBoostMs, 328.3, 0.5, "full boost from Earth's spin");
});

test("windows have an open/close range from the tolerance", () => {
  const { windows } = findWindows("POLAR", { raan: 0, start: START, count: 1, toleranceDeg: 0.5, site: NO_RULES });
  const w = windows[0];
  close((w.closes - w.opens) / 60000, 3.99, 0.05, "±0.5° ≈ 4 minutes total");
  assert.ok(w.opens < w.alignment && w.alignment < w.closes);
});

test("windows come out in order and after the start time", () => {
  const { windows } = findWindows("POLAR", { raan: 45, start: START, count: 5 });
  assert.equal(windows.length, 5);
  assert.ok(windows[0].alignment >= START);
  for (let i = 1; i < windows.length; i++) assert.ok(windows[i].alignment > windows[i - 1].alignment);
});

test("custom inclination works and unreachable custom orbits return no windows", () => {
  const ok = findWindows("CUSTOM", { inclination: 88, raan: 10, start: START, count: 2 });
  assert.equal(ok.reachable, true);
  assert.equal(ok.windows.length, 2);
  const bad = findWindows("CUSTOM", { inclination: 30, raan: 10, start: START });
  assert.equal(bad.reachable, false);
  assert.deepEqual(bad.windows, []);
});

test("a RAAN with a date drifts over time (Earth's bulge)", () => {
  close(raanDriftPerDay(45.1, 500), -5.2, 0.3, "LEO drift °/day");
  const a = findWindows("LEO", { raan: 0, start: START, count: 3, site: NO_RULES });
  const b = findWindows("LEO", { raan: 0, raanEpoch: START, start: START, count: 3, site: NO_RULES });
  const gapA = (a.windows[2].alignment - a.windows[1].alignment) / 60000;
  const gapB = (b.windows[2].alignment - b.windows[1].alignment) / 60000;
  assert.ok(gapB < gapA - 15, `drifting plane comes round sooner (${gapB.toFixed(1)} vs ${gapA.toFixed(1)} min)`);
});

// ---------- rules ----------

test("launch hours rule blocks windows outside 7am–12pm", () => {
  const blocked = checkRules(new Date("2026-10-03T09:15:00Z"), 90); // 6:15am Halifax
  assert.equal(blocked.length, 1);
  assert.match(blocked[0], /outside launch hours/);
  assert.deepEqual(checkRules(new Date("2026-10-03T14:55:00Z"), 190), []); // 11:55am
});

test("launch direction rule blocks headings outside the allowed range", () => {
  const r = findWindows("LEO", { raan: 0, start: START, count: 1, site: { rules: { allowedAzimuth: [150, 200] } } });
  assert.equal(r.windows[0].allowed, false);
  assert.match(r.windows[0].blockedReasons[0], /not permitted/);
});

// ---------- input checks ----------

test("bad inputs give clear errors", () => {
  assert.throws(() => findWindows("LEO", {}), /needs a raan/);
  assert.throws(() => findWindows("MARS", {}), /Unknown orbit/);
  assert.throws(() => findWindows("LEO", { raan: 0, count: 0 }), /count/);
  assert.throws(() => findWindows("LEO", { raan: 0, count: 2.5 }), /count/);
  assert.throws(() => findWindows("LEO", { raan: Number.NaN }), /raan/);
  assert.throws(() => findWindows("LEO", { raan: 0, start: new Date("nope") }), /start/);
  assert.throws(() => findWindows("SSO", { crossingHours: 25 }), /crossingHours/);
  assert.throws(() => findWindows("CUSTOM", { inclination: 200, raan: 0 }), /inclination/);
});

// ---------- cost of delay ----------

test("cost of delay matches hand-calculated values", () => {
  const c = delayCost({ inclination: 98.1, altitudeKm: 690, minutesLate: 5, satelliteMassKg: 100 });
  close(c.twistDeg, 1.241, 0.005, "twist");
  close(c.deltaV, 162.6, 0.5, "Δv m/s");
  close(c.fuelKg, 7.26, 0.05, "fuel kg");
  close(c.launchCostUsd, 7.26 * 6500, 400, "cost");
});

test("no delay costs nothing; plane angle is symmetric", () => {
  assert.equal(delayCost({ inclination: 45.1, altitudeKm: 500, minutesLate: 0, satelliteMassKg: 100 }).fuelKg, 0);
  close(planeAngle(90, 2), 2, 1e-9, "polar orbit: twist equals Ω difference");
  assert.throws(() => delayCost({ inclination: 45, altitudeKm: 500, minutesLate: -1, satelliteMassKg: 100 }));
});
