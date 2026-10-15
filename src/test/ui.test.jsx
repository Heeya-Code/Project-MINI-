import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, loginAs } from './render'
import { STORAGE_KEY } from '../store/persistence'
import { isRecipient } from '../utils/notifications'
import { studentComp } from './helpers'

vi.setConfig({ testTimeout: 30000 })

const savedState = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

let errorSpy
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:30:00')) // a Wednesday
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  expect(errorSpy, `console.error was called: ${errorSpy.mock.calls.map(c => String(c[0]).slice(0, 120)).join(' | ')}`).not.toHaveBeenCalled()
  errorSpy.mockRestore()
  vi.useRealTimers()
})

describe('login and role-based dashboards', () => {
  it('rejects a wrong password', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText('College email'), 'student@tsec.edu')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: /log in as student/i }))
    expect(await screen.findByText(/invalid email, password or role/i)).toBeInTheDocument()
  })

  it('student logs in through the form and lands on the student dashboard with a Schedule Changed alert', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: /Heeya/i }))
    await user.click(screen.getByRole('button', { name: /log in as student/i }))
    expect(await screen.findByText("Today's Schedule")).toBeInTheDocument()
    expect(screen.getByText(/Schedule Changed/)).toBeInTheDocument()
    expect(screen.getAllByText(/Original:/).length).toBeGreaterThan(0) // original vs updated is visible
    expect(screen.queryByText('Manage Timetables')).not.toBeInTheDocument()
  })

  it('teacher and administrator get their own dashboards and navigation', async () => {
    loginAs('teacher@tsec.edu')
    const t = renderApp('/app/dashboard')
    expect(await screen.findByText(/Your lectures today/)).toBeInTheDocument()
    expect(screen.getByText('My Lectures', { selector: 'a' })).toBeInTheDocument()
    t.unmount()
    loginAs('admin@tsec.edu')
    renderApp('/app/dashboard')
    expect((await screen.findAllByText('Total rooms')).length).toBeGreaterThan(0)
    expect(screen.getByText('Manage Timetables', { selector: 'a' })).toBeInTheDocument()
    expect(screen.getByText(/Waiting for your decision/)).toBeInTheDocument()
  })

  it('teacher can browse upcoming lecture dates and see class, division, room type, and building', async () => {
    const user = userEvent.setup()
    loginAs('teacher@tsec.edu')
    renderApp('/app/my-lectures')

    expect((await screen.findAllByText(/Computer Engineering · SEM/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Division C[123]/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/(Classroom|Computer Lab|Electronics Lab) · (Old Building|New Building)/).length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText('Upcoming range'), '7')
    expect(screen.getByLabelText('Upcoming range')).toHaveValue('7')
  })
})

describe('permissions in the UI', () => {
  it.each(['/app/manage-timetable', '/app/history', '/app/requests', '/app/bookings', '/app/my-lectures', '/app/rooms'])('a student typing %s sees Access denied', async path => {
    loginAs('student@tsec.edu')
    renderApp(path)
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })
  it('a teacher cannot open admin-only pages', async () => {
    loginAs('teacher@tsec.edu')
    renderApp('/app/manage-timetable')
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })
  it('logged-out visitors are sent to the login page', async () => {
    renderApp('/app/dashboard')
    expect(await screen.findByText(/Sign in to view your timetable/)).toBeInTheDocument()
  })
  it('a tampered session cannot grant a role (role is re-read from the user list)', async () => {
    localStorage.setItem('tsecsync_user', JSON.stringify({ email: 'student@tsec.edu', role: 'management' }))
    renderApp('/app/history')
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })
})

describe('end-to-end: schedule change reaches the right student', () => {
  it('admin cancels a lecture of the sample student class (COMP SEM V C1) -> a refresh later the student sees the notification', async () => {
    const user = userEvent.setup()
    loginAs('admin@tsec.edu')
    const adminView = renderApp('/app/manage-timetable')
    const before = savedState().notifications.length
    // the sample student (Heeya) is in COMP SEM V C1: pick exactly that class
    await user.selectOptions(await screen.findByLabelText('Department'), 'comp')
    await user.selectOptions(screen.getByLabelText('Semester'), 'SEM V')
    await user.selectOptions(screen.getByLabelText('Division'), 'C1')
    const buttons = await screen.findAllByRole('button', { name: 'Change this date' })
    await user.click(buttons[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel lecture' }))
    await user.type(screen.getByLabelText('Reason (required)'), 'Faculty on leave')
    await user.click(screen.getAllByRole('button', { name: 'Cancel lecture' }).at(-1))
    await waitFor(() => expect(savedState().notifications.length).toBe(before + 1))
    adminView.unmount()

    const note = savedState().notifications[0]
    expect(note.title).toBe('Class Cancelled')
    expect(note.reason).toBe('Faculty on leave')
    expect(isRecipient(studentComp, note)).toBe(true)

    localStorage.setItem('tsecsync_user', JSON.stringify({ email: 'student@tsec.edu' }))
    renderApp('/app/notifications')
    expect(await screen.findByText(note.body)).toBeInTheDocument()
    expect(screen.getByText(/Reason: Faculty on leave/)).toBeInTheDocument()
  })

  it('teacher requests a cancellation -> admin approves -> teacher is told', async () => {
    const user = userEvent.setup()
    loginAs('teacher@tsec.edu')
    const teacherView = renderApp('/app/my-lectures')
    const buttons = await screen.findAllByRole('button', { name: 'Change / cancel' })
    await user.click(buttons.at(-1))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Request cancellation' }))
    await user.type(screen.getByLabelText('Reason (required)'), 'Conference travel')
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(savedState().requests.filter(r => r.status === 'pending')).toHaveLength(2))
    expect(savedState().exceptions.some(e => e.reason === 'Conference travel')).toBe(false) // nothing published before approval
    teacherView.unmount()

    loginAs('admin@tsec.edu')
    const adminView = renderApp('/app/requests')
    const approve = await screen.findAllByRole('button', { name: 'Approve' })
    await user.click(approve[0]) // newest request first
    await waitFor(() => expect(savedState().exceptions.some(e => e.reason === 'Conference travel')).toBe(true))
    adminView.unmount()

    loginAs('teacher@tsec.edu')
    renderApp('/app/notifications')
    expect(await screen.findByText('Request approved')).toBeInTheDocument()
  })

  it('a booking conflict is shown live in the booking form', async () => {
    const user = userEvent.setup()
    loginAs('admin@tsec.edu')
    renderApp('/app/bookings')
    await user.click(await screen.findByRole('button', { name: '+ Book a room' }))
    const dlg = await screen.findByRole('dialog')
    // seeded booking: C-304, tomorrow-ish 16:00-17:00 -> pick that room/time/date
    const bk = savedState().bookings.find(b => b.id === 'bk2')
    await user.selectOptions(within(dlg).getByLabelText('Room / lab / hall'), bk.roomId)
    const date = within(dlg).getByLabelText('Date')
    await user.clear(date); await user.type(date, bk.date)
    expect(await within(dlg).findByText(/Booking Conflict/)).toBeInTheDocument()
    expect(within(dlg).getByText(/already occupied during the selected time/)).toBeInTheDocument()
    expect(within(dlg).getByRole('button', { name: /confirm booking/i })).toBeDisabled()
  })
})

describe('every page renders without console errors', () => {
  const pages = {
    student: ['/app/dashboard', '/app/timetable', '/app/events', '/app/seminars', '/app/notifications', '/app/profile'],
    teacher: ['/app/dashboard', '/app/timetable', '/app/my-lectures', '/app/bookings', '/app/requests', '/app/rooms', '/app/events', '/app/seminars', '/app/notifications', '/app/profile'],
    admin: ['/app/dashboard', '/app/manage-timetable', '/app/bookings', '/app/requests', '/app/rooms', '/app/events', '/app/seminars', '/app/history', '/app/notifications', '/app/profile', '/app/timetable'],
  }
  const email = { student: 'student@tsec.edu', teacher: 'teacher@tsec.edu', admin: 'admin@tsec.edu' }
  for (const [role, paths] of Object.entries(pages)) {
    it.each(paths)(`${role}: %s`, async path => {
      loginAs(email[role])
      renderApp(path)
      await waitFor(() => expect(screen.getByRole('main')).not.toBeEmptyDOMElement())
      expect(screen.queryByText('Access denied')).not.toBeInTheDocument()
    })
  }
})
