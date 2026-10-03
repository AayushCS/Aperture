/**
 * Save CelesTrak's active-satellite catalogue (GP / OMM JSON) to data/active.json.
 *
 * The app only reads this snapshot; it never contacts CelesTrak at runtime.
 * CelesTrak refreshes GP data about every 2 hours and blocks clients that
 * download the same data more often, so run this occasionally, not on a loop.
 *
 *   bun run data:satellites
 */
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseGpRecord } from '../packages/orbital-core/src/traffic'

const SOURCE = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON'
const OUT = path.resolve(import.meta.dir, '../data/active.json')

function fail(message: string): never {
  console.error(`✗ ${message}\n  data/active.json was left unchanged.`)
  process.exit(1)
}

const res = await fetch(SOURCE, { signal: AbortSignal.timeout(60_000) }).catch((e: unknown) =>
  fail(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
)
const text = await res.text()
if (!res.ok) fail(`CelesTrak responded ${res.status}: ${text.slice(0, 200)}`)

// Throttling and other notices come back as plain text, so never overwrite the snapshot with them
let data: unknown
try {
  data = JSON.parse(text)
} catch {
  fail(`CelesTrak did not return JSON: ${text.slice(0, 200)}`)
}
if (!Array.isArray(data) || data.length === 0) fail('Expected a non-empty array of GP records.')

const usable = data.filter((r) => parseGpRecord(r) !== null).length
if (usable === 0) fail('No records had usable orbital elements.')

await mkdir(path.dirname(OUT), { recursive: true })
const tmp = `${OUT}.tmp`
await writeFile(tmp, text)
await rename(tmp, OUT)

const skipped = data.length - usable
console.log(`✓ Saved ${data.length} objects to ${path.relative(process.cwd(), OUT)}${skipped ? ` (${skipped} without usable elements)` : ''}`)
