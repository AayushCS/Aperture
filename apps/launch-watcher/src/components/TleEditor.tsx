import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, FileCode2, Sparkles } from 'lucide-react'
import { HYPOTHETICAL_MISSION_TLE, parseTle, tleChecksum, tleToText } from '@aperture/orbital-core'
import { useMissionStore } from '@/store/mission'
import { CATALOG } from '@/data/catalog'
import { Button } from '@/components/ui/Button'
import { inputClass } from '@/components/ui/Form'
import TleView from '@/components/TleView'
import { cn } from '@/utils/cn'

/**
 * Paste / edit the mission TLE. Validates live (length, checksums, ranges);
 * only a valid TLE can be applied.
 */
export default function TleEditor() {
  const committed = useMissionStore((s) => s.mission.tle)
  const setTle = useMissionStore((s) => s.setTle)
  const update = useMissionStore((s) => s.update)
  const [draft, setDraft] = useState(committed)
  const [editing, setEditing] = useState(false)

  // Follow external changes (element editor, catalog targeting) while not editing
  useEffect(() => {
    if (!editing) setDraft(committed)
  }, [committed, editing])

  const result = useMemo(() => parseTle(draft), [draft])
  const dirty = draft.trim() !== committed.trim()
  const committedParsed = parseTle(committed)

  // Per-line checksum hints for the draft
  const lineHints = draft
    .split(/\r?\n/)
    .filter((l) => /^[12] /.test(l))
    .map((l) => ({ no: l[0], ok: l.length === 69 && Number(l[68]) === tleChecksum(l), len: l.length, expected: tleChecksum(l) }))

  const apply = () => {
    const errors = setTle(draft)
    if (errors.length) toast.error(errors[0])
    else {
      setEditing(false)
      toast.success('Mission orbit updated from TLE')
    }
  }

  return (
    <div className="space-y-4">
      {committedParsed.ok && !editing && <TleView name={committedParsed.tle.name} lines={committedParsed.lines} />}

      {editing ? (
        <div className="space-y-2">
          <label htmlFor="tle-text" className="text-xs font-medium text-muted-foreground">
            Two-line element set (optional name line first)
          </label>
          <textarea
            id="tle-text"
            spellCheck={false}
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(inputClass, 'h-auto whitespace-pre py-2 font-mono text-xs leading-relaxed', !result.ok && 'border-nogo/60')}
            aria-invalid={!result.ok}
            aria-describedby="tle-status"
          />
          <div id="tle-status" className="space-y-1 text-xs" aria-live="polite">
            {result.ok ? (
              <p className="flex items-center gap-1.5 text-go">
                <CheckCircle2 className="size-3.5" aria-hidden /> Valid TLE · catalog {result.tle.catalogNumber} · checksums OK
              </p>
            ) : (
              result.errors.map((err) => (
                <p key={err} className="flex items-start gap-1.5 text-red-300">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {err}
                </p>
              ))
            )}
            {!result.ok && lineHints.length > 0 && (
              <p className="text-muted-foreground">
                {lineHints.map((h) => `Line ${h.no}: ${h.len} chars, checksum should be ${h.expected}`).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!result.ok || !dirty}>
              Apply TLE
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(committed)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <FileCode2 aria-hidden /> Paste / edit TLE
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTle(HYPOTHETICAL_MISSION_TLE)
              update({ name: 'APERTURE-1 · first light' })
              toast('Loaded hypothetical APERTURE-1')
            }}
          >
            <Sparkles aria-hidden /> APERTURE-1
          </Button>
          <label className="sr-only" htmlFor="tle-catalog">
            Target a catalog satellite's orbit
          </label>
          <select
            id="tle-catalog"
            className={cn(inputClass, 'h-8 w-auto text-xs')}
            value=""
            onChange={(e) => {
              const sat = CATALOG.find((s) => s.id === e.target.value)
              if (!sat) return
              setTle(tleToText(sat.tle))
              update({ name: `Into ${sat.name}'s plane` })
              toast.success(`Mission now targets ${sat.name}'s orbit`)
            }}
          >
            <option value="">Target a catalog orbit…</option>
            {CATALOG.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.orbitClass})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}