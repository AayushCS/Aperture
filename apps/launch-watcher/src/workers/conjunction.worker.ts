import { prepareScreeningObjects, screenWindow, type ConjunctionScreen, type ScreenedWindow, type ScreeningObject } from '@aperture/orbital-core'
import { fetchSnapshot } from '@/lib/fetchSnapshot'

export interface ScreenRequest {
  requestId: number
  snapshotUrl: string
  orbit: { altitude: number; inclination: number }
  windows: Array<ScreenedWindow & { id: string }>
}

export type ScreenMessage =
  | { type: 'result'; requestId: number; id: string; screen: ConjunctionScreen }
  | { type: 'done'; requestId: number }
  | { type: 'error'; requestId: number; message: string }

const post = (message: ScreenMessage) => (self as unknown as Worker).postMessage(message)

let records: Promise<unknown[]> | undefined
let prepared: { altitude: number; objects: ScreeningObject[] } | undefined
let latest = 0

self.onmessage = async (event: MessageEvent<ScreenRequest>) => {
  const req = event.data
  latest = req.requestId
  try {
    records ??= fetchSnapshot(req.snapshotUrl)
    const raw = await records
    if (prepared?.altitude !== req.orbit.altitude) {
      prepared = { altitude: req.orbit.altitude, objects: prepareScreeningObjects(raw, req.orbit.altitude) }
    }
    for (const w of req.windows) {
      if (req.requestId !== latest) return
      post({ type: 'result', requestId: req.requestId, id: w.id, screen: screenWindow(prepared.objects, req.orbit, w) })
      // Yield so a newer request (mission edited) can supersede this one
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    post({ type: 'done', requestId: req.requestId })
  } catch (err) {
    records = undefined
    post({ type: 'error', requestId: req.requestId, message: err instanceof Error ? err.message : String(err) })
  }
}
