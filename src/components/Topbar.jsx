import { Link } from 'react-router-dom'
import { departments } from '../data/departments'
import { ROLE_LABELS } from '../utils/permissions'
import { formatDate, todayISO } from '../utils/dates'

export default function Topbar({ user, unreadCount, onMenuClick }) {
  const dept = departments.find(d => d.id === user?.department)
  const initials = (user?.name || '?').replace(/^(Prof\.|Dr\.)\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('')
  const context = [dept?.name, user?.semester && `${user.semester}${user.division ? ` · Div ${user.division}` : ''}`].filter(Boolean).join(' · ')
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button className="topbar-hamburger" onClick={onMenuClick} aria-label="Open menu">{'\u2630'}</button>
        <div className="topbar-left">
          <div className="topbar-title">TSEC Sync <span className="topbar-role">{ROLE_LABELS[user?.role]}</span></div>
          <div className="topbar-sub">{context ? `${context} · ` : ''}{formatDate(todayISO())}</div>
        </div>
      </div>
      <div className="topbar-right">
        <Link to="/app/notifications" className="icon-btn" aria-label={`Notifications, ${unreadCount} unread`}>
          {'\uD83D\uDD14'}
          {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
        </Link>
        <Link to="/app/profile" className="avatar" title={user?.name} aria-label="Profile">{initials}</Link>
      </div>
    </header>
  )
}
