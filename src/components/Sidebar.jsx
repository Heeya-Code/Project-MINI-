import { NavLink } from 'react-router-dom'
import { useData } from '../context/DataContext'

const COMMON = [
  { to: '/app/dashboard', label: 'Dashboard', icon: '\u2302' },
  { to: '/app/timetable', label: 'Timetable', icon: '\u25A6' },
]
const ROOM_AVAILABILITY = { to: '/app/rooms', label: 'Room Availability', icon: '\u25A3' }
const SHARED_TAIL = [
  { to: '/app/events', label: 'Events', icon: '\u2605' },
  { to: '/app/seminars', label: 'Seminars', icon: '\u2691' },
  { to: '/app/notifications', label: 'Notifications', icon: '\u26A0' },
  { to: '/app/profile', label: 'Profile', icon: '\u263A' },
]
const NAV_BY_ROLE = {
  student: [...COMMON, ...SHARED_TAIL],
  teacher: [
    ...COMMON,
    { to: '/app/my-lectures', label: 'My Lectures', icon: '\u270E' },
    { to: '/app/bookings', label: 'My Bookings', icon: '\u2637' },
    { to: '/app/requests', label: 'My Requests', icon: '\u21C4' },
    ROOM_AVAILABILITY,
    ...SHARED_TAIL,
  ],
  management: [
    ...COMMON,
    { to: '/app/manage-timetable', label: 'Manage Timetables', icon: '\u270E' },
    { to: '/app/timetable-uploads', label: 'Timetable Uploads', icon: '\u21E7' },
    { to: '/app/bookings', label: 'All Bookings', icon: '\u2637' },
    { to: '/app/requests', label: 'Approvals', icon: '\u21C4', badge: true },
    ROOM_AVAILABILITY,
    ...SHARED_TAIL,
    { to: '/app/history', label: 'Change History', icon: '\u29D6' },
  ],
}

export default function Sidebar({ role, open, onClose, onLogout }) {
  const { state } = useData()
  const pending = state.requests.filter(r => r.status === 'pending').length + state.bookings.filter(b => b.status === 'pending').length + state.events.filter(e => e.status === 'proposed').length
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.student
  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="mark">TSEC Sync</div>
          <div className="tag">One Campus. One Schedule.</div>
        </div>
        <nav className="sidebar-nav">
          {items.map(item => (
            <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.badge && pending > 0 && <span className="side-badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button onClick={onLogout} className="sidebar-link sidebar-btn">
            <span className="sidebar-icon" aria-hidden="true">{'\u23FB'}</span> Logout
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
    </>
  )
}
