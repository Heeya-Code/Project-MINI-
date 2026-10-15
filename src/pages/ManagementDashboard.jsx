import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import DashboardCard from '../components/DashboardCard'
import StatCard from '../components/StatCard'
import BuildingCard from '../components/BuildingCard'
import { rooms } from '../data/rooms'
import { entriesByDate, roomStatuses } from '../utils/schedule'
import { formatDate, nowHHMM, toHHMM, toMinutes, todayISO } from '../utils/dates'

export function buildingStats(buildingName, statuses) {
  const list = rooms.filter(r => r.building === buildingName)
  const occupied = list.filter(r => statuses[r.id].status === 'Occupied').length
  return {
    total: list.length, occupied, available: list.length - occupied,
    labs: list.filter(r => r.type.includes('Lab')).length, halls: list.filter(r => r.type === 'Seminar Hall').length,
  }
}

export default function ManagementDashboard() {
  const { state } = useData()
  const today = todayISO()
  const now = nowHHMM()
  const statuses = roomStatuses(state, today, now, toHHMM(Math.min(toMinutes(now) + 1, 1439)))
  const occupied = rooms.filter(r => statuses[r.id].status === 'Occupied').length
  const pendingChanges = state.requests.filter(r => r.status === 'pending')
  const pendingBookings = state.bookings.filter(b => b.status === 'pending')
  const pendingSeminars = state.events.filter(e => e.status === 'proposed')
  const todaysEvents = state.events.filter(e => e.date === today && e.status === 'scheduled').length
  const changedToday = (entriesByDate(state, [today])[today] || []).filter(e => e.status !== 'scheduled').length
  const weekAgo = Date.now() - 7 * 86400000
  const recent = state.audit.filter(a => new Date(a.at).getTime() >= weekAgo)

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard label="Total rooms" value={rooms.length} />
        <StatCard label="Available rooms (now)" value={rooms.length - occupied} />
        <StatCard label="Occupied rooms (now)" value={occupied} />
        <StatCard label="Today's events" value={todaysEvents} />
        <StatCard label="Pending requests" value={pendingChanges.length + pendingBookings.length + pendingSeminars.length} tone="old" />
        <StatCard label="Schedule changes today" value={changedToday} />
        <StatCard label="Changes in last 7 days" value={recent.length} />
        <StatCard label="Active lectures / week" value={state.lectures.length} />
      </div>

      <div className="grid grid-2">
        <BuildingCard name="Old Building" stats={buildingStats('Old Building', statuses)} />
        <BuildingCard name="New Building" stats={buildingStats('New Building', statuses)} />
      </div>

      <div className="grid grid-2">
        <DashboardCard title="Waiting for your decision" action={<Link to="/app/requests" className="btn btn-brass btn-sm">Review</Link>}>
          {pendingChanges.length + pendingBookings.length + pendingSeminars.length === 0 ? <p>Nothing is waiting for approval.</p> : (
            <>
              {pendingChanges.slice(0, 3).map(r => {
                const lec = state.lectures.find(l => l.id === r.lectureId)
                return <div className="schedule-item" key={r.id}><div className="schedule-info"><h4>{lec?.subject || r.proposal?.subject} — {r.type === 'cancel' ? 'cancel' : r.type === 'add' ? 'new lecture' : 'change'}</h4><div className="meta">{r.requestedBy.name}{r.date ? ` · ${formatDate(r.date)}` : ''}</div></div></div>
              })}
              {pendingSeminars.slice(0, 3).map(e => <div className="schedule-item" key={e.id}><div className="schedule-info"><h4>{e.title} — seminar proposal</h4><div className="meta">{e.proposedBy?.name} · {formatDate(e.date)}</div></div></div>)}
              {pendingBookings.slice(0, 3).map(b => <div className="schedule-item" key={b.id}><div className="schedule-info"><h4>{b.roomId} booking</h4><div className="meta">{b.createdBy.name} · {formatDate(b.date)}</div></div></div>)}
            </>
          )}
        </DashboardCard>
        <DashboardCard title="Recent changes" action={<Link to="/app/history" className="btn btn-outline btn-sm">Full history</Link>}>
          {state.audit.slice(0, 5).map(a => (
            <div className="schedule-item" key={a.id}><div className="schedule-info"><h4 style={{ fontSize: 13 }}>{a.summary}</h4><div className="meta">{a.by} · {new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div></div></div>
          ))}
        </DashboardCard>
      </div>
    </div>
  )
}
