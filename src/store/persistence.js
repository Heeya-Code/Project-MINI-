// Persistence layer. State is saved to localStorage so a page refresh keeps every
// change. HONEST LIMITATION: localStorage is per browser — two different
// computers/phones do NOT share data. Tabs of the SAME browser do (see
// DataContext: it re-reads storage on the `storage` event and every few seconds).
// A real multi-user deployment replaces this file with API calls.
import { buildSeedState, STATE_VERSION } from './seed.js'

export const STORAGE_KEY = 'tsecsync_state_v2'

export function loadState(storage, seedFn = () => buildSeedState()) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.version === STATE_VERSION) return parsed
    }
  } catch { /* corrupt data -> reseed below */ }
  const fresh = seedFn()
  saveState(storage, fresh)
  return fresh
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false // storage full / blocked: the app keeps working in memory
  }
}

// Read-modify-write: ALWAYS starts from what is in storage right now (not from a
// possibly stale copy in React state). Two "simultaneous" booking attempts are
// therefore applied one after the other, and the second one sees the first.
export function commit(storage, fn, seedFn) {
  const current = loadState(storage, seedFn)
  const out = fn(current)
  if (out.state === current) return { state: current, result: out.result }
  const next = { ...out.state, rev: (current.rev || 0) + 1 }
  saveState(storage, next)
  return { state: next, result: out.result }
}

export function resetState(storage, seedFn = () => buildSeedState()) {
  const fresh = seedFn()
  saveState(storage, fresh)
  return fresh
}
