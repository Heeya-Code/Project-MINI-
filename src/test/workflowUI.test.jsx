import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, loginAs } from './render'
import { createLocalBackend } from './localBackend'
import { STORAGE_KEY } from '../store/persistence'

vi.setConfig({ testTimeout: 30000 })
let errorSpy
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:30:00')) // a Wednesday
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('no network in UI tests'))))
})
afterEach(() => {
  expect(errorSpy, `console.error: ${errorSpy.mock.calls.map(c => String(c[0]).slice(0, 120)).join(' | ')}`).not.toHaveBeenCalled()
  errorSpy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers()
})
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

describe('teacher request -> administrator notification -> decision (UI)', () => {
  it('teacher requests a new lecture; admin is notified and approves; teacher is told; the class timetable gains the lecture', async () => {
    const user = userEvent.setup()
    loginAs('teacher@tsec.edu')
    let view = renderApp('/app/requests')
    await user.click(await screen.findByRole('button', { name: /request a new lecture/i }))
    const dlg = screen.getByRole('dialog', { name: /request a new lecture/i })
    await user.selectOptions(within(dlg).getByLabelText('Semester'), 'SEM V') // the sample student (Heeya) is COMP SEM V C1
    await user.type(within(dlg).getByLabelText('Subject'), 'Remedial Mathematics')
    await user.selectOptions(within(dlg).getByLabelText('Weekday'), 'Friday')
    await user.selectOptions(within(dlg).getByLabelText('Room'), 'C-302')
    fireEvent.change(within(dlg).getByLabelText('Start'), { target: { value: '16:00' } })
    fireEvent.change(within(dlg).getByLabelText('End'), { target: { value: '17:00' } })
    await user.type(within(dlg).getByLabelText('Reason'), 'Extra practice')
    await user.click(within(dlg).getByRole('button', { name: /send request/i }))
    await waitFor(() => expect(saved().requests.some(r => r.type === 'add' && r.status === 'pending')).toBe(true))
    expect(await screen.findByText(/Remedial Mathematics — new lecture/)).toBeInTheDocument()
    view.unmount()

    // administrator: bell badge + notification with details + a link that opens the request
    loginAs('admin@tsec.edu')
    view = renderApp('/app/notifications')
    const card = (await screen.findByText(/Approval needed: new lecture/)).closest('.notif-card')
    expect(within(card).getByText(/Dr\. Rupali Sarode/)).toBeInTheDocument()
    expect(card).toHaveClass('unread')
    await user.click(within(card).getByRole('button', { name: /^open$/i }))
    const approveButtons = await screen.findAllByRole('button', { name: /^approve$/i })
    await user.click(approveButtons[0])
    await waitFor(() => expect(saved().requests.find(r => r.type === 'add').status).toBe('approved'))
    expect(saved().lectures.some(l => l.subject === 'Remedial Mathematics' && l.faculty === 'Dr. Rupali Sarode')).toBe(true)
    view.unmount()

    loginAs('teacher@tsec.edu')
    view = renderApp('/app/notifications')
    expect(await screen.findByText('Request approved')).toBeInTheDocument()
    view.unmount()

    // the student of that class is told; a student of another class is not
    loginAs('student@tsec.edu')
    view = renderApp('/app/notifications')
    expect(await screen.findByText(/Timetable Updated/)).toBeInTheDocument()
    expect(screen.getAllByText(/Remedial Mathematics/).length).toBeGreaterThan(0)
    view.unmount()
    loginAs('student.it@tsec.edu')
    renderApp('/app/notifications')
    await screen.findByRole('heading', { name: /Notifications/ })
    expect(screen.queryByText(/Remedial Mathematics/)).toBeNull()
  })

  it('teacher proposes a seminar; admin approves; students in the audience see it only after approval', async () => {
    const user = userEvent.setup()
    loginAs('teacher@tsec.edu')
    let view = renderApp('/app/seminars')
    await user.click(await screen.findByRole('button', { name: /propose a seminar/i }))
    const dlg = screen.getByRole('dialog', { name: /propose a seminar/i })
    await user.type(within(dlg).getByLabelText('Title'), 'Intro to AI Ethics')
    fireEvent.change(within(dlg).getByLabelText('Date'), { target: { value: '2026-10-30' } })
    await user.selectOptions(within(dlg).getByLabelText('Audience — department'), 'comp')
    await user.click(within(dlg).getByRole('button', { name: /send proposal/i }))
    await waitFor(() => expect(saved().events.some(e => e.title === 'Intro to AI Ethics' && e.status === 'proposed')).toBe(true))
    view.unmount()

    loginAs('student@tsec.edu')
    view = renderApp('/app/seminars')
    await screen.findByRole('heading', { name: 'Seminars' })
    expect(screen.queryByText('Intro to AI Ethics')).toBeNull() // not visible before approval
    view.unmount()

    loginAs('admin@tsec.edu')
    view = renderApp('/app/requests')
    expect(await screen.findByText(/Intro to AI Ethics — seminar proposal/)).toBeInTheDocument()
    const row = screen.getByText(/Intro to AI Ethics — seminar proposal/).closest('.booking-row')
    await user.click(within(row).getByRole('button', { name: /approve/i }))
    await waitFor(() => expect(saved().events.find(e => e.title === 'Intro to AI Ethics').status).toBe('scheduled'))
    view.unmount()

    loginAs('student@tsec.edu')
    renderApp('/app/seminars')
    expect(await screen.findByText('Intro to AI Ethics')).toBeInTheDocument()
  })

  it('a seminar proposal that clashes with an existing seminar is refused with the conflict shown', async () => {
    const user = userEvent.setup()
    loginAs('teacher@tsec.edu')
    renderApp('/app/seminars')
    await user.click(await screen.findByRole('button', { name: /propose a seminar/i }))
    const dlg = screen.getByRole('dialog', { name: /propose a seminar/i })
    const sm1 = saved().events.find(e => e.id === 'ev-sm1')
    await user.type(within(dlg).getByLabelText('Title'), 'Clashing talk')
    await user.selectOptions(within(dlg).getByLabelText('Venue'), sm1.roomId)
    fireEvent.change(within(dlg).getByLabelText('Date'), { target: { value: sm1.date } })
    fireEvent.change(within(dlg).getByLabelText('Start'), { target: { value: sm1.start } })
    fireEvent.change(within(dlg).getByLabelText('End'), { target: { value: sm1.end } })
    await user.click(within(dlg).getByRole('button', { name: /send proposal/i }))
    expect(await within(dlg).findByRole('alert')).toHaveTextContent(/conflict/i)
    expect(saved().events.some(e => e.title === 'Clashing talk')).toBe(false)
  })
})

describe('notification centre (UI)', () => {
  it('filters by category and read state, marks read without deleting, and keeps read state per user across a re-login', async () => {
    const user = userEvent.setup()
    loginAs('student@tsec.edu')
    let view = renderApp('/app/notifications')
    await screen.findByRole('heading', { name: /Notifications/ })
    const total = document.querySelectorAll('.notif-card').length
    expect(total).toBeGreaterThan(0)
    await user.selectOptions(screen.getByLabelText('Category'), 'requests')
    expect(document.querySelectorAll('.notif-card').length).toBe(0) // students have no request notifications
    await user.selectOptions(screen.getByLabelText('Category'), 'all')
    await user.click(screen.getAllByRole('button', { name: /mark as read/i })[0])
    await waitFor(() => expect(document.querySelectorAll('.notif-card.unread').length).toBe(Math.max(0, document.querySelectorAll('.notif-card').length - 1)))
    expect(document.querySelectorAll('.notif-card').length).toBe(total) // nothing deleted
    await user.click(screen.getByRole('button', { name: /mark all as read/i }))
    await waitFor(() => expect(document.querySelectorAll('.notif-card.unread').length).toBe(0))
    view.unmount()
    // log in again: still read; another student's read state is separate
    loginAs('student@tsec.edu')
    view = renderApp('/app/notifications')
    await screen.findByRole('heading', { name: /Notifications/ })
    expect(document.querySelectorAll('.notif-card.unread').length).toBe(0)
    expect(saved().reads['student.it@tsec.edu']).toBeUndefined()
    await user.click(screen.getByRole('tab', { name: 'Unread' }))
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
  })

  it('the bell shows the real unread count', async () => {
    loginAs('admin@tsec.edu')
    renderApp('/app/dashboard')
    const bell = await screen.findByRole('link', { name: /Notifications, \d+ unread/ })
    const n = Number(/(\d+) unread/.exec(bell.getAttribute('aria-label'))[1])
    expect(n).toBe(saved().notifications.filter(x => x.audience?.management).length)
  })
})

describe('honest failures (Task 3)', () => {
  it('a failed server call never looks like a success and changes nothing', async () => {
    const backend = createLocalBackend()
    const real = backend.transport.act
    backend.transport.act = vi.fn(async (name, input) => { if (name === 'createBooking') throw Object.assign(new Error('Could not reach the server — nothing was changed.'), { status: 0 }); return real(name, input) })
    loginAs('teacher@tsec.edu')
    const user = userEvent.setup()
    renderApp('/app/bookings', { backend })
    const before = saved().bookings.length
    await user.click(await screen.findByRole('button', { name: /\+ Book a room/ }))
    const purpose = await screen.findByLabelText(/purpose/i)
    await user.type(purpose, 'Doubt session')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-22' } })
    await user.click(screen.getByRole('button', { name: /^(Book|Confirm|Send request|Request)/i }))
    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument()
    expect(saved().bookings.length).toBe(before)
    expect(screen.queryByText(/Room booked/)).toBeNull()
  })

  it('identical actions fired together (a double click) reach the server once', async () => {
    const backend = createLocalBackend()
    const calls = []
    const real = backend.transport.act
    backend.transport.act = vi.fn(async (name, input) => { calls.push(name); await new Promise(r => setTimeout(r, 5)); return real(name, input) })
    loginAs('admin@tsec.edu')
    let captured
    const { DataProvider, useData } = await import('../context/DataContext').then(m => ({ DataProvider: m.DataProvider, useData: m.useData }))
    const { AuthProvider } = await import('../context/AuthContext')
    const { render } = await import('@testing-library/react')
    function Probe() { captured = useData().actions; return null }
    render(<AuthProvider authApi={backend.auth}><DataProvider transport={backend.transport}><Probe /></DataProvider></AuthProvider>)
    const ids = ['n1']
    let a, b
    await act(async () => { [a, b] = await Promise.all([captured.markRead(ids), captured.markRead(ids)]) })
    expect(calls.filter(c => c === 'markRead').length).toBe(1)
    expect(a).toEqual(b)
  })
})
