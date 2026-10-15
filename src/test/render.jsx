import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'
import { DataProvider } from '../context/DataContext'
import { NotificationsProvider } from '../context/NotificationsContext'
import { ToastProvider } from '../context/ToastContext'
import { createLocalBackend, SESSION_KEY } from './localBackend'

export const loginAs = email => localStorage.setItem(SESSION_KEY, JSON.stringify({ email }))

// Renders the whole app against the in-memory backend. Pass `backend` to share one between renders.
export function renderApp(path, { backend = createLocalBackend() } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider authApi={backend.auth}><DataProvider transport={backend.transport}><NotificationsProvider><ToastProvider><App /></ToastProvider></NotificationsProvider></DataProvider></AuthProvider>
    </MemoryRouter>)
}
