import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, loginAs } from './render'
import { mockUsers } from '../data/users'

vi.setConfig({ testTimeout: 30000 })
let errorSpy
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T10:30:00'))
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('no network in UI tests'))))
})
afterEach(() => {
  expect(errorSpy, `console.error: ${errorSpy.mock.calls.map(c => String(c[0]).slice(0, 120)).join(' | ')}`).not.toHaveBeenCalled()
  errorSpy.mockRestore(); vi.unstubAllGlobals(); vi.useRealTimers()
})

const FIVE = [
  { email: 'teacher@tsec.edu', role: 'teacher', roleBtn: 'Teacher', name: 'Dr. Rupali Sarode', dept: 'Computer Engineering' },
  { email: 'teacher2@tsec.edu', role: 'teacher', roleBtn: 'Teacher', name: 'Dr. Sakshi Surve', dept: 'Computer Engineering' },
  { email: 'student@tsec.edu', role: 'student', roleBtn: 'Student', name: 'Heeya Shewkani', dept: 'Computer Engineering', sem: 'TE · SEM V', div: 'C1' },
  { email: 'student.aids@tsec.edu', role: 'student', roleBtn: 'Student', name: 'Dhwani Shriyan', dept: 'AI & Data Science', sem: 'SE · SEM III', div: 'S1' },
  { email: 'student.it@tsec.edu', role: 'student', roleBtn: 'Student', name: 'Tanisha Thakur', dept: 'Information Technology', sem: 'BE · SEM VII', div: 'I1' },
]

describe('the five sample accounts in the UI', () => {
  it('the sample list holds exactly these five accounts (+ the administrator), with unique emails', () => {
    expect(mockUsers.map(u => u.email).sort()).toEqual([...FIVE.map(f => f.email), 'admin@tsec.edu'].sort())
    expect(new Set(mockUsers.map(u => u.email)).size).toBe(mockUsers.length)
    expect(mockUsers.filter(u => u.role === 'teacher').map(u => u.name).sort()).toEqual(['Dr. Rupali Sarode', 'Dr. Sakshi Surve'])
    expect(mockUsers.filter(u => u.role === 'student').map(u => u.name).sort()).toEqual(['Dhwani Shriyan', 'Heeya Shewkani', 'Tanisha Thakur'])
  })

  it.each(FIVE)('$name signs in through the login form and lands on the right dashboard', async a => {
    const user = userEvent.setup()
    renderApp('/login')
    if (a.roleBtn !== 'Student') await user.click(screen.getByRole('button', { name: a.roleBtn }))
    await user.click(screen.getByRole('button', { name: new RegExp(a.name.replace('.', '\\.')) }))
    await user.click(screen.getByRole('button', { name: new RegExp(`log in as ${a.role === 'student' ? 'student' : 'teacher'}`, 'i') }))
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument()
    // the top bar names the department / semester of students
    if (a.sem) { const sub = document.querySelector('.topbar-sub').textContent; expect(sub).toContain(a.dept); expect(sub).toContain(a.sem.split(' · ')[1]); expect(sub).toContain(`Div ${a.div}`) }
  })

  it.each(FIVE)('profile of $name shows the right name, role, department, semester and division', async a => {
    loginAs(a.email)
    renderApp('/app/profile')
    expect(await screen.findByRole('heading', { name: a.name })).toBeInTheDocument()
    expect(screen.getByDisplayValue(a.email)).toBeInTheDocument()
    expect(screen.getByDisplayValue(a.dept)).toBeInTheDocument()
    if (a.sem) { expect(screen.getByDisplayValue(a.sem)).toBeInTheDocument(); expect(screen.getByDisplayValue(a.div)).toBeInTheDocument() }
    else expect(screen.queryByText('Year / Semester')).toBeNull()
  })

  it('teachers cannot open student-only or admin-only screens and students cannot open teacher screens', async () => {
    loginAs('teacher@tsec.edu'); let v = renderApp('/app/manage-timetable')
    expect(await screen.findByText('Access denied')).toBeInTheDocument(); v.unmount()
    loginAs('student.aids@tsec.edu'); renderApp('/app/my-lectures')
    expect(await screen.findByText('Access denied')).toBeInTheDocument()
  })
})

describe('EXTC and Chemistry have one class per semester (no divisions in the UI)', () => {
  it('the Timetable page offers a Division selector for COMP/IT/AI&DS but none for EXTC or Chemistry', async () => {
    loginAs('student@tsec.edu')
    const user = userEvent.setup()
    renderApp('/app/timetable')
    const dept = await screen.findByLabelText('Department'), sem = screen.getByLabelText('Semester')
    await user.selectOptions(dept, 'aids'); await user.selectOptions(sem, 'SEM III')
    expect(within(screen.getByLabelText('Division')).getAllByRole('option').map(o => o.textContent).filter(t => !/All/.test(t))).toEqual(['Division S1', 'Division S2'])
    for (const d of ['extc', 'chem']) {
      await user.selectOptions(dept, d)
      expect(screen.queryByLabelText('Division'), `${d} must have no division selector`).toBeNull()
      for (const s of ['SEM III', 'SEM V', 'SEM VII']) { await user.selectOptions(sem, s); expect(screen.queryByLabelText('Division')).toBeNull() }
    }
    await user.selectOptions(dept, 'comp'); expect(screen.getByLabelText('Division')).toBeInTheDocument()
  })

  it('an EXTC/Chemistry class shows the official-sheet prompt without asking for a division', async () => {
    loginAs('student@tsec.edu')
    const user = userEvent.setup()
    renderApp('/app/timetable')
    await user.selectOptions(await screen.findByLabelText('Department'), 'extc')
    await user.selectOptions(screen.getByLabelText('Semester'), 'SEM V')
    await user.click(screen.getByRole('tab', { name: /official sheet/i }))
    expect(screen.queryByText(/select a department, semester and division/i)).toBeNull()
  })

  it('the demo lectures of EXTC/Chemistry carry no division and lecture cards never print one', async () => {
    loginAs('student@tsec.edu')
    const user = userEvent.setup()
    renderApp('/app/timetable')
    await user.selectOptions(await screen.findByLabelText('Department'), 'chem')
    await user.selectOptions(screen.getByLabelText('Semester'), 'SEM III')
    expect(document.body.textContent).not.toMatch(/Division/)
  })
})
