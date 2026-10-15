import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import DashboardCard from '../components/DashboardCard'
import Timetable from '../components/Timetable'
import OfficialSheet from '../components/OfficialSheet'
import { departments, divisionOptionsFor, hasDivisions, isValidClass, semesters } from '../data/departments'
import { allFaculty } from '../data/faculty'
import { WEEKDAYS, addDays, formatDay, startOfWeek, todayISO, weekDates, weekdayOf } from '../utils/dates'
import { entriesByDate } from '../utils/schedule'
import { roomById } from '../utils/lookup'

// THE timetable page (one sidebar entry for every role). Two views of the same class:
//   Weekly schedule  — the official lectures week by week, with APPROVED changes and cancellations
//                      (original struck through). Pending requests are listed separately and never shown as final.
//   Official sheet   — the published official timetable as printed, with the original PDF.
export default function TimetablePage() {
  const { user } = useAuth()
  const { state } = useData()
  const [params] = useSearchParams()
  const fromLink = { d: params.get('dept'), s: params.get('semester'), v: params.get('division') }
  const linked = isValidClass(fromLink.d, fromLink.s, fromLink.v)
  const [dept, setDept] = useState(linked ? fromLink.d : user.department || 'all')
  const [sem, setSem] = useState(linked ? fromLink.s : user.semester || 'all')
  const [div, setDiv] = useState(linked ? fromLink.v : user.division || 'all')
  const [tab, setTab] = useState(params.get('tab') === 'official' ? 'official' : 'weekly')
  const [day, setDay] = useState('')
  const [building, setBuilding] = useState('')
  const [search, setSearch] = useState('')
  const [faculty, setFaculty] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [anchor, setAnchor] = useState(todayISO())

  const monday0 = startOfWeek(anchor)
  const matches = l => !l.inactive && (dept === 'all' || l.deptId === dept) && (sem === 'all' || l.semester === sem) && (div === 'all' || l.division === div)
  const hasSaturday = !day && state.lectures.some(l => l.weekday === 'Saturday' && matches(l)) // official COMP sheets run Mon–Sat
  const dates = [...weekDates(anchor), ...(hasSaturday ? [addDays(monday0, 5)] : [])].filter(d => !day || weekdayOf(d) === day)
  const entries = useMemo(() => entriesByDate(state, dates, e => {
    const l = e.lecture
    if (dept !== 'all' && l.deptId !== dept) return false
    if (sem !== 'all' && l.semester !== sem) return false
    if (div !== 'all' && l.division !== div) return false
    if (search && !l.subject.toLowerCase().includes(search.toLowerCase())) return false
    if (faculty && l.faculty !== faculty && e.effective.faculty !== faculty) return false
    if (mineOnly && l.faculty !== user.name && e.effective.faculty !== user.name) return false
    if (building && roomById(e.effective.roomId)?.building !== building && roomById(e.original.roomId)?.building !== building) return false
    return true
  }), [state, dates.join(), dept, sem, div, search, faculty, mineOnly, building, user.name])

  const monday = startOfWeek(anchor)
  // EXTC and Chemistry have one class per semester (no division): choosing department + semester is enough
  const classChosen = dept !== 'all' && sem !== 'all' && (!hasDivisions(dept) || div !== 'all')
  const sameClass = l => l.deptId === dept && l.semester === sem && (!hasDivisions(dept) || l.division === div)
  // requests that are NOT approved yet: shown separately, never as part of the timetable
  const pending = classChosen ? state.requests.filter(r => r.status === 'pending' && (() => { const l = state.lectures.find(x => x.id === r.lectureId); return l ? sameClass(l) : sameClass(r.proposal || {}) })()) : []
  return (
    <DashboardCard title="Timetable">
      <div className="filter-bar">
        <select aria-label="Department" value={dept} onChange={e => { setDept(e.target.value); if (e.target.value === 'all') setDiv('all'); else if (!divisionOptionsFor(e.target.value, sem).includes(div)) setDiv('all') }}>{[{ id: 'all', name: 'All departments' }, ...departments].map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select aria-label="Semester" value={sem} onChange={e => { setSem(e.target.value); if (dept !== 'all' && e.target.value !== 'all' && !divisionOptionsFor(dept, e.target.value).includes(div)) setDiv('all') }}><option value="all">All semesters</option>{semesters.map(s => <option key={s}>{s}</option>)}</select>
        {(dept === 'all' || hasDivisions(dept)) && <select aria-label="Division" value={div} onChange={e => setDiv(e.target.value)}><option value="all">All divisions</option>{(dept === 'all' ? ['all'] : divisionOptionsFor(dept, sem)).filter(v => v !== 'all').map(d => <option key={d} value={d}>Division {d}</option>)}</select>}
        <select aria-label="Day" value={day} onChange={e => setDay(e.target.value)}><option value="">All days</option>{WEEKDAYS.map(d => <option key={d}>{d}</option>)}</select>
        <select aria-label="Building" value={building} onChange={e => setBuilding(e.target.value)}><option value="">All buildings</option><option>Old Building</option><option>New Building</option></select>
        <input aria-label="Search subject" placeholder="Search subject…" value={search} onChange={e => setSearch(e.target.value)} />
        {user.role !== 'student' && (
          <select aria-label="Faculty" value={faculty} onChange={e => setFaculty(e.target.value)}><option value="">All faculty</option>{allFaculty.map(f => <option key={f}>{f}</option>)}</select>
        )}
        {user.role === 'teacher' && <label className="check"><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} /> My lectures only</label>}
      </div>
      <div className="tabs" role="tablist" aria-label="Timetable view">
        {[['weekly', 'Weekly schedule'], ['official', 'Official sheet & PDF']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'official' ? <OfficialSheet dept={dept} sem={sem} div={hasDivisions(dept) ? div : ''} isAdmin={user.role === 'management'} /> : <>
      <div className="week-nav">
        <button className="btn btn-outline btn-sm" onClick={() => setAnchor(addDays(anchor, -7))}>{'\u2039'} Previous week</button>
        <strong>Week of {formatDay(monday)}</strong>
        <button className="btn btn-outline btn-sm" onClick={() => setAnchor(todayISO())}>This week</button>
        <button className="btn btn-outline btn-sm" onClick={() => setAnchor(addDays(anchor, 7))}>Next week {'\u203A'}</button>
      </div>
      <div className="legend">
        <span className="chip chip-good">Regular</span><span className="chip chip-warn">Changed (original struck through)</span><span className="chip chip-bad">Cancelled</span>
      </div>
      {classChosen && !Object.values(entries).some(list => list.length) && (
        <div className="ott-note" role="note">
          No lectures this week for this class. Check the{' '}
          <button className="link-btn" onClick={() => setTab('official')}><strong>Official sheet &amp; PDF</strong></button> tab, or another week.
        </div>
      )}
      <Timetable dates={dates} entriesByDate={entries} showClass={sem === 'all' || div === 'all'} />
      {pending.length > 0 && (
        <div className="ott-note" role="note" style={{ marginTop: 14 }}>
          <strong>Waiting for administrator approval — not in effect yet</strong>
          <ul>{pending.map(r => <li key={r.id}>{r.type === 'add' ? `New lecture: ${r.proposal.subject}` : `${r.type === 'cancel' ? 'Cancellation' : 'Change'} of ${state.lectures.find(l => l.id === r.lectureId)?.subject || 'a lecture'} on ${r.date}`} — requested by {r.requestedBy.name}</li>)}</ul>
          <Link to="/app/requests">Open requests</Link>
        </div>
      )}
      </>}
    </DashboardCard>
  )
}
