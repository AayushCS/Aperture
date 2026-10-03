import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orbitTraffic, parseGpRecord, type OrbitTraffic, type TrafficObject } from '@aperture/orbital-core'
import { fetchSnapshot } from '@/lib/fetchSnapshot'
import { loadSnapshotUrl } from '@/lib/satelliteSnapshot'

async function loadCatalogue(): Promise<TrafficObject[]> {
  const raw = await fetchSnapshot(await loadSnapshotUrl!())
  return raw.map(parseGpRecord).filter((o): o is TrafficObject => o !== null)
}

export type OrbitTrafficState =
  | { status: 'missing' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; traffic: OrbitTraffic }

/** Catalogued objects sharing the target shell and inclination */
export function useOrbitTraffic(altitude: number, inclination: number): OrbitTrafficState {
  const query = useQuery({
    queryKey: ['satellite-snapshot'],
    queryFn: loadCatalogue,
    enabled: loadSnapshotUrl !== undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  const traffic = useMemo(
    () => (query.data ? orbitTraffic(query.data, { altitude, inclination }) : undefined),
    [query.data, altitude, inclination]
  )

  if (!loadSnapshotUrl) return { status: 'missing' }
  if (query.isError) return { status: 'error', message: query.error.message }
  if (!traffic) return { status: 'loading' }
  return { status: 'ready', traffic }
}
