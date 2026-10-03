import { NavLink, Outlet } from 'react-router-dom'
import { CalendarClock, Globe2, Info, Radar } from 'lucide-react'
import { cn } from '@/utils/cn'
import OrbitBackdrop from './OrbitBackdrop'
import TleDialog from './TleDialog'
import { SiteDialog } from './SiteWidget'

const NAV = [
  { to: '/', label: 'Launch Watch', icon: Radar, end: true },
  { to: '/planner', label: 'Window Planner', icon: CalendarClock, end: false },
  { to: '/orbit', label: 'Orbit', icon: Globe2, end: false },
] as const

export default function Layout() {
  return (
    <>
    <OrbitBackdrop />
    <div className="relative z-10 flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="Aperture home">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="text-sm font-semibold tracking-tight">Aperture</span>
            <span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground md:inline">Nova Scotia</span>
          </NavLink>

          <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                <Icon aria-hidden className="size-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="container flex-1 space-y-6 py-6 lg:py-8">
        <p role="note" className="flex items-center gap-2.5 rounded-lg bg-sky-400/10 px-3 py-2 text-sm text-sky-100 ring-1 ring-inset ring-sky-400/25">
          <Info aria-hidden className="size-4 shrink-0 text-sky-300" />
          Simulation: Spaceport Nova Scotia's orbital pad is expected to open in 2027–28.
        </p>
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="container flex flex-col gap-1 py-4 text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
          <span>Aperture · Spaceport Nova Scotia launch planner · hypothetical mission, planning estimates only</span>
          <span>
            Weather:{' '}
            <a className="underline-offset-2 hover:underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{' '}
            · Map data: Natural Earth
          </span>
        </div>
      </footer>
    </div>
    <TleDialog />
    <SiteDialog />
    </>
  )
}
