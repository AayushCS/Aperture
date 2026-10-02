// Run with:  node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SITE, ORBITS, isReachable, launchAzimuth, nodeOffset, gmst,
  localSiderealAngle, targetSiderealAngle, sunRightAscension, findWindows, norm360,
} from "./launchWindows.js";

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected}, got ${actual}`);

// Angle difference that handles wrap-around (359° vs 1° are 2° apart).
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test("all three orbit types are reachable from Nova Scotia", () => {
  for (const key of Object.keys(ORBITS)) assert.ok(isReachable(ORBITS[key].inclination), key);
  assert.equal(isReachable(30), false, "a 30° orbit is too flat for a 45.1° site");
});

test("launch direction matches the answers table", () => {
  close(launchAzimuth(45.1, SITE.lat, false), 90, 0.01, "LEO flies due east");
  close(launchAzimuth(90, SITE.lat, true), 180, 0.01, "Polar flies due south");
  close(launchAzimuth(98.1, SITE.lat, true), 191.5, 0.1, "SSO flies south-southwest");
});

test("node offset Δλ matches the answers table", () => {
  close(nodeOffset(45.1), 90, 0.01, "LEO");
  close(nodeOffset(90), 0, 0.01, "Polar");
  close(nodeOffset(98.1), -8.2, 0.1, "SSO");
});

test("Earth rotation angle at J2000 is the known value", () => {
  close(gmst(new Date("2000-01-01T12:00:00Z")), 280.46061837, 1e-6, "GMST at J2000");
});

test("Sun is in the right place on the March equinox", () => {
  // Around 2026-03-20 the Sun's right ascension is ~0°.
  assert.ok(angleDiff(sunRightAscension(new Date("2026-03-20T15:00:00Z")), 0) < 1);
});

test("at each window, the site really is at the target angle", () => {
  for (const key of ["LEO", "POLAR"]) {
    const raan = 120;
    const { windows } = findWindows(key, { raan, start: new Date("2026-10-03T00:00:00Z"), count: 3 });
    const o = ORBITS[key];
    const target = targetSiderealAngle(o.inclination, raan, SITE.lat, o.south);
    for (const w of windows) assert.ok(angleDiff(localSiderealAngle(w.time), target) < 0.01, key);
  }
});

test("LEO and Polar windows repeat every sidereal day (23h 56m 4s)", () => {
  const { windows } = findWindows("LEO", { raan: 0, start: new Date("2026-10-03T00:00:00Z"), count: 3 });
  const gapSeconds = (windows[1].time - windows[0].time) / 1000;
  close(gapSeconds, 86164.1, 2, "gap between windows");
});

test("SSO windows land at about the same clock time every day", () => {
  const { windows } = findWindows("SSO", { start: new Date("2026-10-03T00:00:00Z"), count: 3 });
  const gapHours = (windows[1].time - windows[0].time) / 3600000;
  close(gapHours, 24, 0.05, "SSO gap");
  // With a 10:30am crossing, the Sun is ~14.3° east of overhead at launch (about 11:03 local solar time).
  const hourAngle = norm360(localSiderealAngle(windows[0].time) - sunRightAscension(windows[0].time));
  close(hourAngle, 345.7, 0.3, "Sun hour angle at SSO launch");
});

test("windows come out in order and after the start time", () => {
  const start = new Date("2026-10-03T00:00:00Z");
  const { windows } = findWindows("POLAR", { raan: 45, start, count: 5 });
  assert.equal(windows.length, 5);
  assert.ok(windows[0].time >= start);
  for (let i = 1; i < windows.length; i++) assert.ok(windows[i].time > windows[i - 1].time);
});

test("missing Ω for LEO gives a clear error", () => {
  assert.throws(() => findWindows("LEO", {}), /needs a raan/);
});
