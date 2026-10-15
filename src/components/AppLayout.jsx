import { useState } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

export default function AppLayout() {
  const { user, ready, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (!ready) return <div className="login-wrap"><div className="login-card" role="status"><p>Checking your session…</p></div></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <div className="app-shell">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={async () => { await logout(); navigate('/login') }} />
      <div className="main-col">
        <Topbar user={user} unreadCount={unreadCount} onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-body"><Outlet /></main>
      </div>
    </div>
  )
}
