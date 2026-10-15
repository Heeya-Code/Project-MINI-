import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import DashboardCard from '../components/DashboardCard'
import LectureEntry from '../components/LectureEntry'
import ChangeLectureModal from '../components/ChangeLectureModal'
import NewLectureRequestModal from '../components/NewLectureRequestModal'
import { addDays, formatDate, todayISO } from '../utils/dates'
import { entriesByDate } from '../utils/schedule'
import { isMine } from './TeacherDashboard'

const RANGE_OPTIONS = [7, 14, 21, 30]

// Teacher: their upcoming lectures, including date-specific changes, with change / cancel actions.
export default function MyLecturesPage() {
  const { user } = useAuth()
  const { state } = useData()
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [range, setRange] = useState(21)
  const today = todayISO()
  const dates = Array.from({ length: range }, (_, i) => addDays(today, i))
  const byDate = entriesByDate(state, dates, e => isMine(e, user.name) && (!search || e.lecture.subject.toLowerCase().includes(search.toLowerCase())) && (!onlyChanged || e.status !== 'scheduled'))
  const days = dates.filter(d => byDate[d].length)
  const pending = state.requests.filter(r => r.status === 'pending' && r.requestedBy.email === user.email)

  return (
    <DashboardCard title="My Lectures">
      <div className="filter-bar">
        <input aria-label="Search subject" placeholder="Search subject…" value={search} onChange={e => setSearch(e.target.value)} />
        <label className="field-inline">Upcoming
          <select aria-label="Upcoming range" value={range} onChange={e => setRange(Number(e.target.value))}>
            {RANGE_OPTIONS.map(daysAhead => <option key={daysAhead} value={daysAhead}>Next {daysAhead} days</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> Only changed / cancelled</label>
        <button className="btn btn-outline btn-sm" onClick={() => setRequesting(true)}>Request a new lecture</button>
      </div>
      {days.length === 0 && <div className="empty-state"><div className="glyph">{'\u270E'}</div>No lectures match.</div>}
      {days.map(d => (
        <section key={d} className="day-block">
          <h4 className="day-title">{formatDate(d)}{d === today && <span className="chip chip-good" style={{ marginLeft: 8 }}>Today</span>}</h4>
          <div className="stack-sm">
            {byDate[d].map(e => {
              const waiting = pending.some(r => r.lectureId === e.lecture.id && r.date === e.originalDate)
              return (
                <LectureEntry key={e.key} entry={e} showClass actions={<>
                  {waiting && <span className="badge badge-warn">Request pending approval</span>}
                  {!e.movedOut && <button className="btn btn-outline btn-sm" onClick={() => setEditing(e)}>Change / cancel</button>}
                </>} />
              )
            })}
          </div>
        </section>
      ))}
      {requesting && <NewLectureRequestModal onClose={() => setRequesting(false)} />}
      {editing && <ChangeLectureModal entry={editing} onClose={() => setEditing(null)} />}
    </DashboardCard>
  )
}
