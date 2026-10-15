import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import DashboardCard from '../components/DashboardCard'
import Timetable from '../components/Timetable'
import LectureEditor from '../components/LectureEditor'
import ChangeLectureModal from '../components/ChangeLectureModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { departments, divisionOptionsFor, defaultDivisionFor, hasDivisions, semesters } from '../data/departments'
import { allFaculty } from '../data/faculty'
import { rooms } from '../data/rooms'
import { addDays, formatDay, nextWorkingDay, startOfWeek, todayISO, weekDates } from '../utils/dates'
import { entriesByDate } from '../utils/schedule'
import { deptName, roomById } from '../utils/lookup'

// Admin: manage ANY department's timetable. Edits touch one lecture at a time, so editing
// IT can never change AIDS. Bulk actions are scoped to the department selected here.
export default function ManageTimetablePage() {
  const { state, actions } = useData()
  const toast = useToast()
  const [dept, setDept] = useState('all')
  const [sem, setSem] = useState('all')
  const [div, setDiv] = useState('all')
  const [faculty, setFaculty] = useState('')
  const [building, setBuilding] = useState('')
  const [room, setRoom] = useState('')
  const [anchor, setAnchor] = useState(todayISO())
  const [editor, setEditor] = useState(null) // { lecture? }
  const [changing, setChanging] = useState(null)
  const [bulkDate, setBulkDate] = useState(nextWorkingDay(addDays(todayISO(), 1)))
  const [confirmBulk, setConfirmBulk] = useState(false)

  const dates = weekDates(anchor)
  const entries = useMemo(() => entriesByDate(state, dates, e => {
    const l = e.lecture
    return (dept === 'all' || l.deptId === dept) && (sem === 'all' || l.semester === sem) && (div === 'all' || l.division === div) &&
      (!faculty || l.faculty === faculty || e.effective.faculty === faculty) &&
      (!room || e.effective.roomId === room || e.original.roomId === room) &&
      (!building || roomById(e.effective.roomId)?.building === building || roomById(e.original.roomId)?.building === building)
  }), [state, dates.join(), dept, sem, div, faculty, room, building])

  const say = async p => { const r = await p; toast(r.ok ? 'success' : 'error', r.message) }

  return (
    <div className="stack">
      <DashboardCard title={`Manage timetable — ${deptName(dept)}`} action={<button className="btn btn-brass btn-sm" onClick={() => setEditor({})}>+ Add lecture</button>}>
        <div className="filter-bar">
          <select aria-label="Department" value={dept} onChange={e => { setDept(e.target.value); setDiv(e.target.value === 'all' ? 'all' : defaultDivisionFor(e.target.value)) }}>{[{ id: 'all', name: 'All departments' }, ...departments].map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select aria-label="Semester" value={sem} onChange={e => setSem(e.target.value)}><option value="all">All semesters</option>{semesters.map(s => <option key={s}>{s}</option>)}</select>
          {(dept === 'all' || hasDivisions(dept)) && <select aria-label="Division" value={div} onChange={e => setDiv(e.target.value)}><option value="all">All divisions</option>{(dept === 'all' ? ['all'] : divisionOptionsFor(dept, sem)).filter(v => v !== 'all').map(d => <option key={d} value={d}>Division {d}</option>)}</select>}
          <select aria-label="Faculty" value={faculty} onChange={e => setFaculty(e.target.value)}><option value="">All faculty</option>{allFaculty.map(f => <option key={f}>{f}</option>)}</select>
          <select aria-label="Building" value={building} onChange={e => setBuilding(e.target.value)}><option value="">All buildings</option><option>Old Building</option><option>New Building</option></select>
          <select aria-label="Room" value={room} onChange={e => setRoom(e.target.value)}><option value="">All rooms</option>{rooms.map(r => <option key={r.id}>{r.id}</option>)}</select>
        </div>
        <div className="week-nav">
          <button className="btn btn-outline btn-sm" onClick={() => setAnchor(addDays(anchor, -7))}>{'\u2039'} Previous week</button>
          <strong>Week of {formatDay(startOfWeek(anchor))}</strong>
          <button className="btn btn-outline btn-sm" onClick={() => setAnchor(todayISO())}>This week</button>
          <button className="btn btn-outline btn-sm" onClick={() => setAnchor(addDays(anchor, 7))}>Next week {'\u203A'}</button>
        </div>
        <Timetable dates={dates} entriesByDate={entries} showClass={sem === 'all' || div === 'all'} renderActions={e => !e.movedOut && (
          <>
            {e.lecture.source === 'official'
              ? <span className="chip" title="This lecture comes from an official published timetable. Change its weekly slot in Timetable Uploads (new draft -> publish).">Official · weekly slot via Uploads</span>
              : <button className="btn btn-outline btn-sm" onClick={() => setEditor({ lecture: e.lecture })}>Edit weekly slot</button>}
            {e.originalDate >= todayISO() && <button className="btn btn-outline btn-sm" onClick={() => setChanging(e)}>Change this date</button>}
          </>
        )} />
      </DashboardCard>

      <DashboardCard title={`Department actions — ${deptName(dept)} only`}>
        <div className="grid grid-2">
          <div>
            <h4>Cancel a whole day</h4>
            <p className="tt-cell-meta">Cancels every active lecture of {deptName(dept)}{sem !== 'all' ? ` (${sem})` : ''} on one date, e.g. for an exam or holiday. Other departments are not touched.</p>
            <div className="filter-bar"><input aria-label="Date to cancel" type="date" min={todayISO()} value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmBulk(true)}>Cancel lectures…</button></div>
          </div>
          <div>
            <h4>Publish timetable update</h4>
            <p className="tt-cell-meta">Sends a “timetable published” notification to {deptName(dept)} students and faculty{sem !== 'all' ? ` (${sem})` : ''}.</p>
            <button className="btn btn-brass btn-sm" onClick={() => say(actions.publishTimetable({ deptId: dept, semester: sem }))}>Publish update</button>
          </div>
        </div>
      </DashboardCard>

      {editor && <LectureEditor lecture={editor.lecture} defaults={{ deptId: dept === 'all' ? 'comp' : dept, semester: sem === 'all' ? 'SEM III' : sem, division: div === 'all' ? defaultDivisionFor(dept === 'all' ? 'comp' : dept) : div }} onClose={() => setEditor(null)} />}
      {changing && <ChangeLectureModal entry={changing} onClose={() => setChanging(null)} />}
      {confirmBulk && <ConfirmDialog title="Cancel all lectures that day?" danger requireReason confirmLabel="Cancel lectures"
        message={`All active ${deptName(dept)} lectures${sem !== 'all' ? ` for ${sem}` : ''} on ${bulkDate} will be cancelled and students notified.`}
        onConfirm={reason => { say(actions.bulkCancelDay({ deptId: dept, semester: sem, date: bulkDate, reason })); setConfirmBulk(false) }} onClose={() => setConfirmBulk(false)} />}
    </div>
  )
}
