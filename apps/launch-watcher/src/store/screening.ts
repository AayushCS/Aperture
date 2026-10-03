import { create } from 'zustand'
import type { ConjunctionScreen, LaunchWindow } from '@aperture/orbital-core'
import { loadSnapshotUrl } from '@/lib/satelliteSnapshot'
import type { ScreenMessage, ScreenRequest } from '@/workers/conjunction.worker'

export interface ScreeningState {
  status: 'idle' | 'missing' | 'running' | 'done' | 'error'
  /** Screen results by window id; windows still being screened are absent */
  results: Record<string, ConjunctionScreen>
  total: number
  error?: string
}

/** Post-insertion conjunction screen results, shared by every page */
export const useScreeningStore = create<ScreeningState>()(() => ({ status: 'idle', results: {}, total: 0 }))

let worker: Worker | undefined
let currentKey: string | undefined
let requestId = 0

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/conjunction.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<ScreenMessage>) => {
      const msg = event.data
      if (msg.requestId !== requestId) return
      if (msg.type === 'result') useScreeningStore.setState((s) => ({ results: { ...s.results, [msg.id]: msg.screen } }))
      else if (msg.type === 'done') useScreeningStore.setState({ status: 'done' })
      else useScreeningStore.setState({ status: 'error', error: msg.message })
    }
  }
  return worker
}

/** Screen the windows in the background worker unless this exact set is already screened or in progress */
export function requestScreening(orbit: { altitude: number; inclination: number }, windows: readonly LaunchWindow[]): void {
  const key = [orbit.altitude, orbit.inclination, ...windows.map((w) => `${w.id}@${w.raan}@${w.insertion.time.getTime()}`)].join('|')
  if (key === currentKey) return
  currentKey = key
  const id = ++requestId

  if (!loadSnapshotUrl) return useScreeningStore.setState({ status: 'missing', results: {}, total: windows.length })
  if (windows.length === 0) return useScreeningStore.setState({ status: 'done', results: {}, total: 0 })
  useScreeningStore.setState({ status: 'running', results: {}, total: windows.length, error: undefined })

  loadSnapshotUrl().then((snapshotUrl) => {
    if (id !== requestId) return
    const request: ScreenRequest = {
      requestId: id,
      snapshotUrl,
      orbit,
      windows: windows.map((w) => ({
        id: w.id,
        raan: w.raan,
        branch: w.branch,
        insertion: { time: w.insertion.time, latitude: w.insertion.latitude },
      })),
    }
    getWorker().postMessage(request)
  })
}
