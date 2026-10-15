import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { httpTransport } from '../api/transport'
import { setExtraRooms } from '../utils/lookup'

const DataContext = createContext(null)
const POLL_MS = 4000

// The shared application data (lectures, changes, requests, bookings, events, notifications, audit) now lives
// on the SERVER. This provider:
//   * loads what the logged-in user may see,
//   * re-checks the server every few seconds (database-backed polling — NOT instant push) and when the tab
//     becomes visible again,
//   * sends every change to the server and updates the screen from the SAVED result.
// If the server cannot be reached an action fails with a clear message; nothing is faked locally.
export function DataProvider({ children, transport = httpTransport }) {
  const { user, logout } = useAuth()
  const [state, setState] = useState(() => transport.peek?.() ?? null)
  const [error, setError] = useState(null)
  const revRef = useRef(state?.rev)

  const apply = useCallback(next => {
    setExtraRooms(next.officialRooms)
    revRef.current = next.rev
    setState(next)
  }, [])

  const refresh = useCallback(async ({ force = false } = {}) => {
    try {
      const out = await transport.load(force ? undefined : revRef.current)
      if (out.state) apply(out.state)
      setError(null)
    } catch (e) {
      if (e.status === 401) { setState(null); revRef.current = undefined; logout() } // session ended -> back to the login page
      setError(e)
    }
  }, [transport, apply, logout])

  // load on login, forget everything on logout
  useEffect(() => {
    if (!user) { setState(null); revRef.current = undefined; setError(null); return undefined }
    if (state && transport.peek) return undefined
    refresh({ force: true })
    return undefined
  }, [user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return undefined
    const poll = () => { if (document.visibilityState !== 'hidden') refresh() }
    const timer = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    window.addEventListener('focus', poll)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', poll); window.removeEventListener('focus', poll) }
  }, [user?.email, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(async (name, input) => {
    try {
      const out = await transport.act(name, input)
      if (out.state) apply(out.state)
      return out.result
    } catch (e) {
      if (e.status === 401) logout()
      return { ok: false, error: true, message: e.status === 403 ? 'You are not allowed to do this.' : e.status === 401 ? 'Your session has ended. Please log in again.' : e.message || 'Could not reach the server — nothing was changed.' }
    }
  }, [transport, apply, logout])

  // Identical calls that are still in flight (a double click) share ONE request, so nothing is applied twice.
  const inflight = useRef(new Map())
  const act = useCallback((name, input) => {
    const key = `${name}:${JSON.stringify(input ?? {})}`
    if (inflight.current.has(key)) return inflight.current.get(key)
    const p = run(name, input).finally(() => inflight.current.delete(key))
    inflight.current.set(key, p)
    return p
  }, [run])

  const actions = useMemo(() => ({
    changeLecture: i => act('changeLecture', i), cancelLecture: i => act('cancelLecture', i), restoreLecture: i => act('restoreLecture', i),
    decideRequest: i => act('decideRequest', i), requestNewLecture: i => act('requestNewLecture', i),
    createBooking: i => act('createBooking', i), updateBooking: i => act('updateBooking', i), cancelBooking: i => act('cancelBooking', i), decideBooking: i => act('decideBooking', i),
    saveEvent: i => act('saveEvent', i), cancelEvent: i => act('cancelEvent', i),
    proposeSeminar: i => act('proposeSeminar', i), updateSeminarProposal: i => act('updateSeminarProposal', i), decideSeminar: i => act('decideSeminar', i),
    saveLecture: i => act('saveLecture', i), deleteLecture: i => act('deleteLecture', i), bulkCancelDay: i => act('bulkCancelDay', i),
    publishTimetable: i => act('publishTimetable', i), setSettings: i => act('setSettings', i),
    markRead: ids => act('markRead', { ids }),
    refresh,
  }), [act, refresh])

  if (user && !state) {
    return (
      <div className="login-wrap">
        <div className="login-card" role={error ? 'alert' : 'status'} aria-live="polite">
          <h2 style={{ marginBottom: 6 }}>TSEC Sync</h2>
          {error
            ? <>
                <p>{error.status === 401 ? 'Your session has ended. Please log in again.' : error.status === 0 || error.code === 'NETWORK' ? 'The TSEC Sync server cannot be reached. Start it with "npm run dev:all" (or "npm run server") and try again.' : error.message}</p>
                <button className="btn btn-primary" onClick={() => refresh({ force: true })}>Try again</button>
              </>
            : <p>Loading your timetable…</p>}
        </div>
      </div>
    )
  }
  return <DataContext.Provider value={{ state, actions, error }}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
