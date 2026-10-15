// TEST-ONLY in-memory backend: the same operations, role gate and per-user view the server uses, kept in
// localStorage so UI tests stay fast. It is never imported by the production bundle.
import { mockUsers } from '../data/users'
import { commit, loadState } from '../store/persistence'
import { ACTIONS, roleAllows } from '../store/actions'
import { viewFor } from '../store/view'
import { setExtraRooms } from '../utils/lookup'
import { todayISO } from '../utils/dates'

export const SESSION_KEY = 'tsecsync_user'
const strip = ({ password: _p, ...u }) => u

export function createLocalBackend(storage = window.localStorage) {
  const peek = () => {
    try { const saved = JSON.parse(storage.getItem(SESSION_KEY)); const m = saved && mockUsers.find(u => u.email === saved.email); return m ? strip(m) : null } catch { return null }
  }
  const demoAccounts = mockUsers.map(({ email, password, role, name }) => ({ email, password, role, name }))
  const view = user => { const s = loadState(storage); setExtraRooms(s.officialRooms); return viewFor(s, user) }
  const forbid = (status, message) => Object.assign(new Error(message), { status })
  return {
    auth: {
      peek, peekConfig: () => ({ demoAccounts }),
      async config() { return { demoAccounts } },
      async me() { return peek() },
      async login(email, password, role) {
        const m = mockUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password && u.role === role)
        if (!m) return { ok: false, message: 'Invalid email, password or role.' }
        storage.setItem(SESSION_KEY, JSON.stringify({ email: m.email }))
        return { ok: true, user: strip(m) }
      },
      async logout() { storage.removeItem(SESSION_KEY) },
    },
    transport: {
      peek: () => { const u = peek(); return u ? view(u) : null },
      async load(rev) { const u = peek(); if (!u) throw forbid(401, 'Please sign in.'); const s = loadState(storage); return rev === s.rev ? { unchanged: true, rev } : { state: view(u) } },
      async act(name, input) {
        const u = peek()
        if (!u) throw forbid(401, 'Please sign in.')
        if (!ACTIONS[name]) throw forbid(404, 'Unknown action.')
        if (!roleAllows(u.role, name)) throw forbid(403, 'Your role is not allowed to do this.')
        const out = commit(storage, s => ACTIONS[name](s, u, input, { today: todayISO() }))
        return { result: out.result, rev: out.state.rev, state: view(u) }
      },
    },
  }
}
