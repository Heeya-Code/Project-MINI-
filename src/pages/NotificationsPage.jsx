import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationsContext'
import { useData } from '../context/DataContext'
import NotificationCard from '../components/NotificationCard'
import DashboardCard from '../components/DashboardCard'
import { CATEGORY_LABELS } from '../utils/notifications'

// The ONE notification centre. Everything shown here was stored by the server for this user only.
export default function NotificationsPage() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const { error, actions } = useData()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [category, setCategory] = useState('all')
  const shown = notifications.filter(n => (tab === 'all' || n.unread) && (category === 'all' || n.category === category))
  const open = async n => { if (n.unread) await markRead(n.id); navigate(n.link) }
  return (
    <DashboardCard title={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      action={unreadCount > 0 && <button className="btn btn-outline btn-sm" onClick={markAllRead}>Mark all as read</button>}>
      {error && <div className="ott-note" role="alert">Could not refresh from the server ({error.message}). Showing the last data received. <button className="link-btn" onClick={() => actions.refresh({ force: true })}>Try again</button></div>}
      <div className="filter-bar">
        <div className="tabs" role="tablist" style={{ margin: 0 }}>
          {[['all', 'All'], ['unread', 'Unread']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {shown.length === 0
        ? <div className="empty-state"><div className="glyph">{'\uD83D\uDD14'}</div>{tab === 'unread' ? "You're all caught up." : 'No notifications yet.'}</div>
        : <div className="stack-sm">{shown.map(n => <NotificationCard key={n.id} notif={n} onRead={markRead} onOpen={open} />)}</div>}
      <p className="muted-text" style={{ marginBottom: 0 }}>New notifications appear automatically within a few seconds (the page checks the server regularly).</p>
    </DashboardCard>
  )
}
