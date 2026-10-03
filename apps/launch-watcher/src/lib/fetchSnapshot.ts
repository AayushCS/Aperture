/** Fetch and minimally validate the saved GP snapshot (no import.meta.glob here, so workers can import it) */
export async function fetchSnapshot(url: string): Promise<unknown[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load satellite snapshot (${res.status})`)
  const raw: unknown = await res.json()
  if (!Array.isArray(raw)) throw new Error('Satellite snapshot is not a GP record array')
  return raw
}
