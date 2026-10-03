// "Cost of delay" calculator (Ben's suggestion).
//
// If the rocket launches late, the Earth has turned a little, so the satellite
// ends up in an orbit that is twisted compared with the one it wanted. The
// satellite must then burn its own fuel to twist it back. Fuel is mass, and
// mass costs money to launch.
//
// Steps:
// 1. Twist: the Earth turns 0.2507° per minute, so Ω is off by that much per minute.
// 2. Speed change to fix it: Δv = 2 · v · sin(θ / 2)
// 3. Fuel for that speed change (rocket equation): fuel = m · (1 − e^(−Δv / (Isp · g0)))
//
// Simplification: assumes the satellite fixes the twist itself in one burn at
// its target orbit; a real rocket's upper stage can steer away part of the error.

import { EARTH_DEG_PER_DAY, orbitalSpeed } from "./launchWindows.js";

const DEG = Math.PI / 180;
const G0 = 9.80665; // m/s²

// SpaceX Transporter rideshare price per kg (Payload Space, March 2023). Update if you find a newer figure.
export const RIDESHARE_USD_PER_KG = 6500;

/** Angle between two orbit planes with the same tilt whose Ω differ by dRaan. */
export function planeAngle(inclination, dRaanDeg) {
  const i = inclination * DEG;
  const cosT = Math.cos(i) ** 2 + Math.sin(i) ** 2 * Math.cos(dRaanDeg * DEG);
  return Math.acos(Math.max(-1, Math.min(1, cosT))) / DEG;
}

/**
 * @param {object} p
 * @param {number} p.inclination      orbit tilt, degrees
 * @param {number} p.altitudeKm       orbit altitude, km
 * @param {number} p.minutesLate      how late the launch is (minutes)
 * @param {number} p.satelliteMassKg  satellite mass before the fix, kg
 * @param {number} [p.isp]            engine efficiency in seconds (default 220, typical small-satellite thruster)
 * @param {number} [p.usdPerKg]       launch price per kg (default SpaceX rideshare)
 */
export function delayCost({ inclination, altitudeKm, minutesLate, satelliteMassKg, isp = 220, usdPerKg = RIDESHARE_USD_PER_KG }) {
  for (const [name, v] of Object.entries({ inclination, altitudeKm, minutesLate, satelliteMassKg, isp, usdPerKg })) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a number ≥ 0`);
  }
  const dRaan = (EARTH_DEG_PER_DAY / 1440) * minutesLate;
  const twistDeg = planeAngle(inclination, dRaan);
  const v = orbitalSpeed(altitudeKm);
  const deltaV = 2 * v * Math.sin((twistDeg * DEG) / 2);
  const fuelKg = satelliteMassKg * (1 - Math.exp(-deltaV / (isp * G0)));
  return {
    twistDeg,
    deltaV, // m/s
    fuelKg,
    fuelShare: satelliteMassKg > 0 ? fuelKg / satelliteMassKg : 0, // fraction of the satellite that must be fuel
    launchCostUsd: fuelKg * usdPerKg, // cost of carrying that fuel to orbit
  };
}
