import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'
import { DataProvider } from '../context/DataContext'
import { NotificationsProvider } from '../context/NotificationsContext'
import { ToastProvider } from '../context/ToastContext'
import { createLocalBackend } from './localBackend'
import { loginAs } from './render'
import { normalizeEntryUrl } from '../utils/entry'

vi.setConfig({ testTimeout: 30000 })
let errorSpy
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('no network in UI tests'))))
  localStorage.clear()
})
afterEach(() => {
  expect(errorSpy, `console.error: ${errorSpy.mock.calls.map(c => String(c[0]).slice(0, 120)).join(' | ')}`).not.toHaveBeenCalled()
  errorSpy.mockRestore(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
})

// A real BrowserRouter on the real window.history: this is exactly how main.jsx boots the app.
function boot() {
  normalizeEntryUrl() // what main.jsx does before the first render
  const backend = createLocalBackend()
  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider authApi={backend.auth}><DataProvider transport={backend.transport}><NotificationsProvider><ToastProvider><App /></ToastProvider></NotificationsProvider></DataProvider></AuthProvider>
    </BrowserRouter>)
}
const openAt = path => window.history.replaceState(null, '', path)

describe('every reload / fresh entry opens the public home page', () => {
  it('normalizeEntryUrl rewrites any non-home address to "/" and leaves "/" alone', () => {
    for (const p of ['/app/dashboard', '/login', '/app/timetable?dept=it&tab=official#x', '/app/requests?focus=rq1', '/does/not/exist']) {
      openAt(p); expect(normalizeEntryUrl()).toBe(true); expect(window.location.pathname).toBe('/'); expect(window.location.search).toBe('')
    }
    openAt('/'); expect(normalizeEntryUrl()).toBe(false); expect(window.location.pathname).toBe('/')
  })

  it('opening the app shows the home page, and refreshing it keeps the user there', async () => {
    openAt('/'); const v = boot()
    expect(await screen.findByRole('heading', { level: 1, name: /One Campus/ })).toBeInTheDocument()
    v.unmount(); openAt('/'); boot() // "refresh"
    expect(await screen.findByRole('heading', { level: 1, name: /One Campus/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it.each([['/login'], ['/app/dashboard'], ['/app/timetable'], ['/app/profile']])('refreshing %s (logged out) lands on the home page', async path => {
    openAt(path); boot()
    expect(await screen.findByRole('heading', { level: 1, name: /One Campus/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it.each([['teacher@tsec.edu', '/app/dashboard'], ['student@tsec.edu', '/app/dashboard'], ['admin@tsec.edu', '/app/timetable-uploads'], ['student.it@tsec.edu', '/app/timetable']])('refreshing %s on %s (session still valid) lands on the home page, then the dashboard is one click away', async (email, path) => {
    loginAs(email); openAt(path); boot()
    expect(await screen.findByRole('heading', { level: 1, name: /One Campus/ })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('link', { name: /open your dashboard/i })[0])
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app/dashboard')
  })

  it('normal in-app navigation is NOT redirected to the home page', async () => {
    loginAs('teacher@tsec.edu'); openAt('/'); boot()
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('link', { name: /open your dashboard/i }))[0])
    const nav = await screen.findByRole('navigation')
    for (const [label, path] of [['Timetable', '/app/timetable'], ['Notifications', '/app/notifications'], ['Profile', '/app/profile'], ['My Lectures', '/app/my-lectures']]) {
      await user.click(Array.from(nav.querySelectorAll('a')).find(a => a.textContent.includes(label)))
      expect(window.location.pathname).toBe(path)
    }
    expect(screen.queryByRole('heading', { level: 1, name: /One Campus/ })).toBeNull()
  })

  it('protected pages stay protected: typing a protected URL while logged out never shows them', async () => {
    openAt('/app/manage-timetable'); boot()
    expect(await screen.findByRole('heading', { level: 1, name: /One Campus/ })).toBeInTheDocument()
    expect(screen.queryByText(/Manage timetable/i)).toBeNull()
    // and a logged-out in-app navigation to a protected page is still sent to the login page
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('link', { name: /log in/i })[0])
    expect(await screen.findByText(/Sign in to view your timetable/)).toBeInTheDocument()
  })

  it('login still works from the home page and a student cannot open admin pages', async () => {
    openAt('/'); boot()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('link', { name: /log in/i })[0])
    await user.click(await screen.findByRole('button', { name: /Heeya/ }))
    await user.click(screen.getByRole('button', { name: /log in as student/i }))
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app/dashboard')
    // role-based access: the student cannot reach the admin page even through in-app navigation
    await act(async () => { window.history.pushState(null, '', '/app/manage-timetable'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })
})
