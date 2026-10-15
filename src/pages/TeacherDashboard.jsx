import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import DashboardCard from '../components/DashboardCard'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import LectureEntry from '../components/LectureEntry'
import ChangeLectureModal from '../components/ChangeLectureModal'
import { formatDate, isWorkingDay, nextWorkingDay, nowHHMM, toHHMM, toMinutes, todayISO } from '../utils/dates'
import { entriesByDate, roomStatuses } from '../utils/schedule'
import { rooms } from '../data/rooms'
import { roomById } from '../utils/lookup'

export const isMine = (e, name) => e.lecture.faculty === name || e.effective.faculty === name

export default function TeacherDashboard() {
  const { user } = useAuth()
  const { state } = useData()
  const [editing, setEditing] = useState(null)
  const today = todayISO()
  const viewDate = isWorkingDay(today) ? today : nextWorkingDay(today)
  const entries = entriesByDate(state, [viewDate], e => isMine(e, user.name))[viewDate]
  const myRequests = state.requests.filter(r => r.requestedBy.email === user.email)
  const pendingCount = myRequests.filter(r => r.status === 'pending').length + state.bookings.filter(b => b.createdBy?.email === user.email && b.status === 'pending').length + state.events.filter(e => e.proposedBy?.email === user.email && e.status === 'proposed').length
  const now = nowHHMM()
  const status = roomStatuses(state, today, now, toHHMM(Math.min(toMinutes(now) + 1, 1439)))
  const free = rooms.filter(r => status[r.id].status !== 'Occupied').length
  const upcoming = state.events.filter(e => e.status === 'scheduled' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard label={viewDate === today ? 'Your lectures today' : 'Your next lectures'} value={entries.filter(e => e.status !== 'cancelled').length} />
        <StatCard label="Requests awaiting approval" value={pendingCount} />
        <StatCard label="Rooms free right now" value={free} />
        <StatCard label="Upcoming events" value={upcoming.length} />
      </div>

      <DashboardCard title={viewDate === today ? "Today's Lectures" : `Lectures — ${formatDate(viewDate)}`} action={<Link to="/app/my-lectures" className="btn btn-outline btn-sm">All my lectures</Link>}>
        {entries.length === 0 ? <div className="empty-state"><div className="glyph">{'\u2615'}</div>No lectures assigned for this day.</div> : (
          <div className="stack-sm">
            {entries.map(e => (
              <LectureEntry key={e.key} entry={e} showClass actions={
                !e.movedOut && <button className="btn btn-outline btn-sm" onClick={() => setEditing(e)}>Change / cancel</button>} />
            ))}
          </div>
        )}
      </DashboardCard>

      <div className="grid grid-2">
        <DashboardCard title="Your recent requests" action={<Link to="/app/requests" className="btn btn-outline btn-sm">All requests</Link>}>
          {myRequests.length === 0 ? <p>No requests yet. Rescheduling or cancelling a lecture may need administrator approval.</p> : myRequests.slice(0, 3).map(r => {
            const lec = state.lectures.find(l => l.id === r.lectureId)
            return (
              <div className="schedule-item" key={r.id}>
                <div className="schedule-info" style={{ flex: 1 }}><h4>{lec?.subject}</h4><div className="meta">{r.type === 'cancel' ? 'Cancellation' : 'Change'} · {formatDate(r.date)}</div></div>
                <StatusBadge status={r.status} />
              </div>
            )
          })}
        </DashboardCard>
        <DashboardCard title="Upcoming seminars & events" action={<Link to="/app/events" className="btn btn-outline btn-sm">All events</Link>}>
          {upcoming.map(ev => (
            <div className="schedule-item" key={ev.id}>
              <div className="schedule-time">{formatDate(ev.date)}</div>
              <div className="schedule-info"><h4>{ev.title}</h4><div className="meta">{ev.roomId} · {roomById(ev.roomId)?.building}</div></div>
            </div>
          ))}
        </DashboardCard>
      </div>
      {editing && <ChangeLectureModal entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
