import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Modal dialog built on the native <dialog> element: focus trapping, Esc to
 * close and inert background come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Click on the backdrop (the dialog element itself, outside the panel) closes
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto w-[min(640px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-visible bg-transparent p-0 text-foreground',
        'backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95 open:slide-in-from-bottom-4',
        className
      )}
    >
      {open && (
        <div className="glass-panel relative flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              {icon && <div className="mt-0.5 text-primary [&_svg]:size-5">{icon}</div>}
              <div className="min-w-0">
                <h2 id="dialog-title" className="truncate text-base font-semibold tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}