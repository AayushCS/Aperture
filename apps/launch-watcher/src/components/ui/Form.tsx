import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

/** Accessible single-choice segmented control (radio group) */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: ReadonlyArray<Option<T>>
  onChange: (value: T) => void
  className?: string
}) {
  const name = useId()
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="flex rounded-lg border bg-background/50 p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-center text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              value === o.value ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Field({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'h-9 w-full rounded-md border border-input bg-background/60 px-3 text-sm tabular focus-visible:ring-2 focus-visible:ring-ring'

/** Range slider with a synced numeric input */
export function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  hint?: ReactNode
}) {
  const commit = (raw: string) => {
    const v = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
  }
  // Draft text lets users type freely; the value is clamped on blur / Enter
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => commit(e.target.value)}
        />
        <div className="relative w-28 shrink-0">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== null) commit(draft)
              setDraft(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className={cn(inputClass, 'pr-9 text-right')}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {unit}
          </span>
        </div>
      </div>
    </Field>
  )
}
