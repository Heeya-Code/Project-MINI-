// The browser's connection to the server-authoritative state. Production uses these HTTP implementations;
// tests inject an in-memory equivalent (src/test/localBackend.js). Nothing here is allowed to "succeed" locally:
// if the server cannot be reached the action FAILS and the UI says so.
import { api, ApiError } from './client'

const newOpId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).slice(0, 64)

export const httpAuthApi = {
  async config() { try { return await api('/config') } catch { return {} } },
  async me() { try { return (await api('/me')).user } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e } },
  async login(email, password, role) {
    try { return { ok: true, user: (await api('/login', { method: 'POST', body: { email, password, role } })).user } }
    catch (e) { return { ok: false, message: e.message } }
  },
  async logout() { try { await api('/logout', { method: 'POST', body: {} }) } catch { /* already gone */ } },
}

export const httpTransport = {
  // -> { state } | { unchanged: true, rev }
  load: rev => api(`/state${rev !== undefined ? `?rev=${rev}` : ''}`),
  // Every call carries a fresh opId so a network retry of the SAME call can never apply twice.
  async act(name, input = {}, opId = newOpId()) {
    return api(`/actions/${name}`, { method: 'POST', body: { input, opId } })
  },
}
