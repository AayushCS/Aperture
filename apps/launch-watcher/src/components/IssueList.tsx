import { AlertTriangle, XCircle } from 'lucide-react'
import type { FeasibilityIssue } from '@aperture/orbital-core'
import { cn } from '@/utils/cn'

export default function IssueList({ issues, className }: { issues: readonly FeasibilityIssue[]; className?: string }) {
  if (issues.length === 0) return null
  return (
    <ul className={cn('space-y-2', className)} aria-label="Mission constraints">
      {issues.map((issue) => {
        const error = issue.severity === 'error'
        const Icon = error ? XCircle : AlertTriangle
        return (
          <li
            key={issue.code}
            role={error ? 'alert' : undefined}
            className={cn(
              'flex gap-2.5 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset',
              error ? 'bg-nogo/10 text-red-200 ring-nogo/30' : 'bg-watch/10 text-amber-100 ring-watch/30'
            )}
          >
            <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', error ? 'text-nogo' : 'text-watch')} />
            <span>{issue.message}</span>
          </li>
        )
      })}
    </ul>
  )
}
