import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useNotifications } from '../context/NotificationsContext'
import DashboardCard from '../components/DashboardCard'
import StatCard from '../components/StatCard'
import LectureEntry from '../components/LectureEntry'
import NotificationCard from '../components/NotificationCard'
import { addDays, formatDate, isWorkingDay, nextWorkingDay, todayISO } from '../utils/dates'
import { entriesByDate } from '../utils/schedule'
import { deptName } from '../utils/lookup'

export default function StudentDashboard() {
  const { user } = useAuth()
  const { state } = useData()
  const { notifications } = useNotifications()
  const today = todayISO()
  const viewDate = isWorkingDay(today) ? today : nextWorkingDay(today)
  const mine = e => e.lecture.deptId === user.department && e.lecture.semester === user.semester && e.lecture.division === user.division
  const todayEntries = entriesByDate(state, [viewDate], mine)[viewDate]
  const upcomingDates = []
  for (let d = addDays(viewDate, 1); upcomingDates.length < 5; d = addDays(d, 1)) if (isWorkingDay(d)) upcomingDates.push(d)
  const upcoming = entriesByDate(state, upcomingDates, mine)
  const upcomingChanges = upcomingDates.flatMap(d => upcoming[d].filter(e => e.status !== 'scheduled'))
  const changedToday = todayEntries.filter(e => e.status !== 'scheduled')
  const activeToday = todayEntries.filter(e => e.status !== 'cancelled' && !e.movedOut).length
  const events = state.events.filter(e => e.status === 'scheduled' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const relevantEvents = events.filter(e => e.audience.deptId === 'all' || e.audience.deptId === user.department).slice(0, 3)

  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatCard label={viewDate === today ? 'Classes today' : `Classes on ${formatDate(viewDate)}`} value={activeToday} />
        <StatCard label="Schedule changes" value={changedToday.length + upcomingChanges.length} tone="old" />
        <StatCard label="Upcoming events" value={events.length} />
        <StatCard label="Unread notifications" value={notifications.filter(n => n.unread).length} />
      </div>

      {changedToday.length > 0 && (
        <DashboardCard title={'\u26A0 Schedule Changed'}>
          <p style={{ marginTop: 0 }}>Your regular schedule for {viewDate === today ? 'today' : formatDate(viewDate)} has changed. Original and updated details are shown below.</p>
          <div className="stack-sm">{changedToday.map(e => <LectureEntry key={e.key} entry={e} />)}</div>
        </DashboardCard>
      )}

      <DashboardCard title={viewDate === today ? "Today's Schedule" : `Next lectures — ${formatDate(viewDate)}`} action={<Link to="/app/timetable" className="btn btn-outline btn-sm">Full timetable</Link>}>
        <div className="topbar-sub" style={{ marginBottom: 8 }}>{deptName(user.department)} · {user.semester} · Div {user.division}</div>
        {todayEntries.length === 0
          ? <div className="empty-state"><div className="glyph">{'\u2615'}</div>No lectures scheduled.</div>
          : <div className="stack-sm">{todayEntries.map(e => <LectureEntry key={e.key} entry={e} />)}</div>}
      </DashboardCard>

      {upcomingChanges.length > 0 && (
        <DashboardCard title="Upcoming changes this week">
          <div className="stack-sm">{upcomingChanges.map(e => <LectureEntry key={e.key} entry={e} showDate />)}</div>
        </DashboardCard>
      )}

      <div className="grid grid-2">
        <DashboardCard title="Upcoming events & seminars" action={<Link to="/app/events" className="btn btn-outline btn-sm">All events</Link>}>
          {relevantEvents.length === 0 ? <p>No upcoming events.</p> : relevantEvents.map(ev => (
            <div className="schedule-item" key={ev.id}>
              <div className="schedule-time">{formatDate(ev.date)}</div>
              <div className="schedule-info"><h4>{ev.title}</h4><div className="meta">{ev.roomId} · {ev.committee}</div></div>
            </div>
          ))}
        </DashboardCard>
        <DashboardCard title="Recent notifications" action={<Link to="/app/notifications" className="btn btn-outline btn-sm">View all</Link>}>
          {notifications.length === 0 ? <p>You're all caught up.</p> : <div className="stack-sm">{notifications.slice(0, 2).map(n => <NotificationCard key={n.id} notif={n} />)}</div>}
        </DashboardCard>
      </div>
    </div>
  )
}
