import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import RoleRoute from './components/RoleRoute'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ManagementDashboard from './pages/ManagementDashboard'
import TimetablePage from './pages/TimetablePage'
import RoomsPage from './pages/RoomsPage'
import EventsPage from './pages/EventsPage'
import SeminarsPage from './pages/SeminarsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import MyLecturesPage from './pages/MyLecturesPage'
import BookingsPage from './pages/BookingsPage'
import RequestsPage from './pages/RequestsPage'
import ManageTimetablePage from './pages/ManageTimetablePage'
import HistoryPage from './pages/HistoryPage'
import AdminTimetablesPage from './pages/AdminTimetablesPage'
import { useAuth } from './context/AuthContext'

// Old /app/official-timetable bookmarks (used from inside the app) land on the unified Timetable page.
function OfficialTimetableRedirect() {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set('tab', 'official')
  return <Navigate to={`/app/timetable?${next.toString()}`} replace />
}

// Picks the dashboard for the logged-in user's role.
function RoleDashboard() {
  const { user } = useAuth()
  if (user?.role === 'teacher') return <TeacherDashboard />
  if (user?.role === 'management') return <ManagementDashboard />
  return <StudentDashboard />
}

const STAFF = ['teacher', 'management']
const ADMIN = ['management']
const guard = (roles, el) => <RoleRoute roles={roles}>{el}</RoleRoute>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<RoleDashboard />} />
        <Route path="timetable" element={<TimetablePage />} />
        {/* old bookmarks keep working: the Official Timetable now lives on the unified Timetable page */}
        <Route path="official-timetable" element={<OfficialTimetableRedirect />} />
        <Route path="rooms" element={guard(STAFF, <RoomsPage />)} />
        <Route path="events" element={<EventsPage />} />
        <Route path="seminars" element={<SeminarsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        {/* staff-only pages (students see "Access denied" if they type the URL) */}
        <Route path="my-lectures" element={guard(['teacher'], <MyLecturesPage />)} />
        <Route path="bookings" element={guard(STAFF, <BookingsPage />)} />
        <Route path="requests" element={guard(STAFF, <RequestsPage />)} />
        <Route path="manage-timetable" element={guard(ADMIN, <ManageTimetablePage />)} />
        <Route path="timetable-uploads" element={guard(ADMIN, <AdminTimetablesPage />)} />
        <Route path="history" element={guard(ADMIN, <HistoryPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
