// Saved CelesTrak snapshot (`bun run data:satellites`). Imported as a URL so the
// ~7 MB catalogue ships as a static asset instead of JS, and globbed so a missing
// file just disables the features that use it. CelesTrak itself is never contacted at runtime.
const snapshot = import.meta.glob<string>('../../../../data/active.json', { query: '?url', import: 'default' })

/** Resolves the snapshot's URL, or undefined when no snapshot has been saved */
export const loadSnapshotUrl: (() => Promise<string>) | undefined = Object.values(snapshot)[0]
