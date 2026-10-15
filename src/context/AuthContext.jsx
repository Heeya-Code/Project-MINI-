import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { httpAuthApi } from '../api/transport'

const AuthContext = createContext(null)

// Authentication is done ONLY by the server (HttpOnly session cookie). The browser keeps no password
// list, no role table and no token: the logged-in user is whatever GET /api/me says it is.
// `authApi` can be swapped in tests; `peek()` lets a test API answer synchronously.
export function AuthProvider({ children, authApi = httpAuthApi }) {
  const [user, setUser] = useState(() => authApi.peek?.() ?? null)
  const [ready, setReady] = useState(() => !!authApi.peek)
  const [config, setConfig] = useState(() => authApi.peekConfig?.() ?? {})

  useEffect(() => {
    let off = false
    authApi.config().then(c => { if (!off) setConfig(c || {}) }).catch(() => {})
    if (!authApi.peek) {
      authApi.me().then(u => { if (!off) { setUser(u); setReady(true) } }).catch(() => { if (!off) setReady(true) })
    }
    return () => { off = true }
  }, [authApi])

  const login = useCallback(async (email, password, role) => {
    const res = await authApi.login(email.trim(), password, role)
    if (res.ok) setUser(res.user)
    return res
  }, [authApi])

  const logout = useCallback(async () => {
    setUser(null)
    await authApi.logout()
  }, [authApi])

  return <AuthContext.Provider value={{ user, ready, login, logout, demoAccounts: config.demoAccounts || [], serverConfig: config }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
