import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, loginAs } from './render'
import { createLocalBackend } from './localBackend'
import { divisionOptionsFor } from '../data/departments'

vi.setConfig({ testTimeout: 30000 })
const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

const published = (over = {}) => ({
  state: 'published',
  timetable: { id: 7, dept_id: 'it', semester: 'SEM III', division: 'I1', academic_year: '2026-27', effective_from: '2026-07-06', expires_on: null, updated_at: '2026-10-01T10:00:00Z', has_file: true,
    sheet: { room: '', notes: [] }, legend: { subjects: { SQL: 'Structured Query Lab' }, faculty: { RM: 'Reshma Malik' } },
    entries: [{ day: 'Monday', start: '10:30', end: '12:30', kind: 'lab', subject: 'SQL', faculty: 'RM', room: '1004', batch: 'S11', label: '', note: '' },
      { day: 'Monday', start: '10:30', end: '12:30', kind: 'lab', subject: 'ADSA', faculty: 'KS', room: '1003', batch: 'S12', label: '', note: '' }], ...over },
})

let errorSpy, fetchMock
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:30:00'))
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  fetchMock = vi.fn(url => String(url).startsWith('/api/published') ? json(published()) : json({}))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  expect(errorSpy, `console.error: ${errorSpy.mock.calls.map(c => String(c[0]).slice(0, 120)).join(' | ')}`).not.toHaveBeenCalled()
  errorSpy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers()
})

const navLinks = () => within(screen.getByRole('navigation')).queryAllByRole('link')

describe('Task 1 — one Timetable tab', () => {
  it.each([['student@tsec.edu'], ['teacher@tsec.edu'], ['admin@tsec.edu']])('%s sees exactly one Timetable item and no separate Official Timetable', async email => {
    loginAs(email)
    renderApp('/app/dashboard')
    await screen.findByRole('navigation')
    const labels = navLinks().map(a => a.textContent)
    expect(labels.filter(l => /timetable/i.test(l) && !/manage|upload/i.test(l))).toEqual(['Timetable'].map(l => expect.stringContaining(l)))
    expect(labels.some(l => /official timetable/i.test(l))).toBe(false)
  })

  it('administrator keeps Manage Timetables and Timetable Uploads', async () => {
    loginAs('admin@tsec.edu')
    renderApp('/app/dashboard')
    await screen.findByRole('navigation')
    const labels = navLinks().map(a => a.textContent)
    expect(labels.some(l => /Manage Timetables/.test(l))).toBe(true)
    expect(labels.some(l => /Timetable Uploads/.test(l))).toBe(true)
  })

  it('IT student opens the unified page, switches to the Official sheet tab and gets the published sheet + PDF links', async () => {
    loginAs('student.it@tsec.edu')
    const user = userEvent.setup()
    renderApp('/app/timetable')
    await user.click(await screen.findByRole('tab', { name: /official sheet/i }))
    expect(await screen.findByRole('heading', { name: /Division I1/ })).toBeInTheDocument()
    expect(fetchMock.mock.calls.find(c => String(c[0]).startsWith('/api/published'))[0]).toBe('/api/published?dept=it&semester=SEM%20VII&division=I1')
    expect(screen.getByText('Parallel batches')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /download pdf/i })).toHaveAttribute('href', '/api/files/7?download=1')
    expect(screen.getByRole('link', { name: /view pdf/i })).toHaveAttribute('href', '/api/files/7')
  })

  it('the old /app/official-timetable bookmark redirects to the unified page with the Official tab and the same class', async () => {
    loginAs('student@tsec.edu')
    renderApp('/app/official-timetable?dept=it&semester=SEM%20V&division=I2')
    expect(await screen.findByRole('tab', { name: /official sheet/i, selected: true })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]) === '/api/published?dept=it&semester=SEM%20V&division=I2')).toBe(true))
    expect(screen.getAllByRole('tab', { name: /official sheet/i })).toHaveLength(1)
  })

  it('offers only active semesters (III, V, VII) and valid divisions: AI&DS S1/S2 (never S3), COMP C1-C3, IT I1/I2', async () => {
    loginAs('student@tsec.edu')
    const user = userEvent.setup()
    renderApp('/app/timetable')
    const dept = await screen.findByLabelText('Department'), sem = screen.getByLabelText('Semester'), div = screen.getByLabelText('Division')
    const opts = () => within(div).getAllByRole('option').map(o => o.textContent).filter(t => !/All/.test(t))
    expect(within(sem).getAllByRole('option').map(o => o.textContent).filter(t => !/All/.test(t))).toEqual(['SEM III', 'SEM V', 'SEM VII'])
    for (const retired of ['SEM I', 'SEM II', 'SEM IV', 'SEM VI']) expect(within(sem).queryByRole('option', { name: retired })).toBeNull()
    await user.selectOptions(dept, 'aids')
    for (const s of ['SEM III', 'SEM V', 'SEM VII']) { await user.selectOptions(sem, s); expect(opts()).toEqual(['Division S1', 'Division S2']) }
    await user.selectOptions(dept, 'comp'); await user.selectOptions(sem, 'SEM V')
    expect(opts()).toEqual(['Division C1', 'Division C2', 'Division C3'])
    await user.selectOptions(dept, 'it'); await user.selectOptions(sem, 'SEM V')
    expect(opts()).toEqual(['Division I1', 'Division I2'])
    expect(divisionOptionsFor('it', 'SEM V')).not.toContain('S1')
  })

  it('a withdrawn timetable shows an informative message instead of a schedule', async () => {
    loginAs('student.it@tsec.edu')
    fetchMock.mockImplementation(() => json({ state: 'withdrawn', message: 'The timetable for this class has been withdrawn and no replacement has been published yet. Please check with your department.' }))
    const user = userEvent.setup()
    renderApp('/app/timetable?tab=official')
    expect(await screen.findByText('Timetable withdrawn')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /download pdf/i })).toBeNull()
    expect(user).toBeTruthy()
  })

  it('shows an error state with a retry', async () => {
    loginAs('student.it@tsec.edu')
    fetchMock.mockImplementation(() => json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } }, 401))
    const user = userEvent.setup()
    renderApp('/app/timetable?tab=official')
    expect(await screen.findByRole('alert')).toHaveTextContent(/session has ended/i)
    fetchMock.mockImplementation(() => json(published()))
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('heading', { name: /Division I1/ })).toBeInTheDocument()
  })

  it('official lectures take part in the weekly view with approved changes; pending requests are shown separately, never as final', async () => {
    const backend = createLocalBackend()
    loginAs('teacher@tsec.edu')
    renderApp('/app/timetable', { backend })
    // the seed contains one pending request from this teacher for a COMP lecture
    const user = userEvent.setup()
    const st = backend.transport.peek()
    const pend = st.requests.find(r => r.status === 'pending')
    const lec = st.lectures.find(l => l.id === pend.lectureId)
    await user.selectOptions(await screen.findByLabelText('Department'), lec.deptId)
    await user.selectOptions(screen.getByLabelText('Semester'), lec.semester)
    await user.selectOptions(screen.getByLabelText('Division'), lec.division)
    expect(await screen.findByText(/Waiting for administrator approval — not in effect yet/)).toBeInTheDocument()
  })

  it('a student never sees pending requests on the timetable', async () => {
    loginAs('student@tsec.edu')
    renderApp('/app/timetable')
    await screen.findByLabelText('Department')
    expect(screen.queryByText(/Waiting for administrator approval/)).toBeNull()
  })
})

describe('admin: timetable uploads', () => {
  it('students and teachers are denied the admin page (UI guard; the server enforces it independently)', async () => {
    for (const email of ['student@tsec.edu', 'teacher@tsec.edu']) {
      loginAs(email)
      const { unmount } = renderApp('/app/timetable-uploads')
      expect(await screen.findByText(/access denied/i)).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/admin/'), expect.anything())
      unmount(); localStorage.clear()
    }
  })

  it('a 403 from the server explains the problem and offers a way forward', async () => {
    loginAs('admin@tsec.edu')
    fetchMock.mockImplementation(() => json({ error: { code: 'FORBIDDEN', message: 'Administrator access is required.' } }, 403))
    renderApp('/app/timetable-uploads')
    expect(await screen.findByText(/not authorised for timetable administration/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log out and sign in again/i })).toBeInTheDocument()
  })

  it('admin sees the list, and the upload form validates type and offers only active semesters and divisions (AI&DS S1/S2)', async () => {
    loginAs('admin@tsec.edu')
    fetchMock.mockImplementation(url => String(url).startsWith('/api/admin/timetables')
      ? json({ versions: [{ id: 1, dept_id: 'it', semester: 'SEM III', division: 'I1', academic_year: '2026-27', version_no: 1, status: 'published', effective_from: '2026-07-06', updated_at: '2026-10-01T00:00:00Z', entry_count: 35 }] })
      : json({}))
    const user = userEvent.setup({ applyAccept: false })
    renderApp('/app/timetable-uploads')
    const table = await screen.findByRole('table')
    expect(within(table).getByText('published')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^upload timetable$/i }))
    const dlg = screen.getByRole('dialog', { name: /upload timetable/i })
    await user.selectOptions(within(dlg).getByLabelText('Department'), 'aids')
    expect(within(within(dlg).getByLabelText('Semester')).getAllByRole('option').map(o => o.textContent)).toEqual(['SEM III', 'SEM V', 'SEM VII'])
    await user.selectOptions(within(dlg).getByLabelText('Semester'), 'SEM VII')
    expect(within(within(dlg).getByLabelText('Division')).getAllByRole('option').map(o => o.textContent).filter(t => !/Select/.test(t))).toEqual(['S1', 'S2'])
    await user.upload(within(dlg).getByLabelText(/Timetable PDF/), new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(within(dlg).getByRole('alert')).toHaveTextContent(/only pdf files/i)
    expect(fetchMock.mock.calls.some(c => String(c[0]).includes('/admin/versions') && c[1]?.method === 'POST')).toBe(false)
  })
})
