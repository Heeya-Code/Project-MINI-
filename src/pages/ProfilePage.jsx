import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import DashboardCard from '../components/DashboardCard'
import ConfirmDialog from '../components/ConfirmDialog'
import { departments, yearOfSemester } from '../data/departments'
import { ROLE_LABELS } from '../utils/permissions'
import { api } from '../api/client'

const OLD_BROWSER_KEY = 'tsecsync_state_v2' // where the old prototype saved its data in this browser

export default function ProfilePage() {
  const { user, serverConfig } = useAuth()
  const { actions } = useData()
  const toast = useToast()
  const [confirm, setConfirm] = useState(null)
  const dept = departments.find(d => d.id === user?.department)
  const initials = user.name.replace(/^(Prof\.|Dr\.)\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('')
  let oldBrowserData = null
  try { oldBrowserData = localStorage.getItem(OLD_BROWSER_KEY) } catch { /* storage blocked */ }

  async function importOld() {
    try {
      await api('/admin/state/import', { method: 'POST', body: { state: JSON.parse(oldBrowserData) } })
      toast('success', 'Imported. Data from this browser is now stored on the server.')
      actions.refresh({ force: true })
    } catch (e) { toast('error', e.message) }
    setConfirm(null)
  }
  async function resetDemo() {
    try { await api('/admin/state/reset', { method: 'POST', body: { confirm: 'RESET' } }); toast('success', 'Demo data reset.'); actions.refresh({ force: true }) } catch (e) { toast('error', e.message) }
    setConfirm(null)
  }
  return (
    <div className="stack">
      <DashboardCard title="Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials}</div>
          <div><h3 style={{ margin: 0 }}>{user.name}</h3><div className="tt-cell-meta">{ROLE_LABELS[user.role]}</div></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Email</label><input disabled value={user.email} /></div>
          <div className="field"><label>Role</label><input disabled value={ROLE_LABELS[user.role]} /></div>
          {dept && <div className="field"><label>Department</label><input disabled value={dept.name} /></div>}
          {user.semester && <div className="field"><label>Year / Semester</label><input disabled value={`${yearOfSemester(user.semester)} · ${user.semester}`} /></div>}
          {user.division && <div className="field"><label>Division</label><input disabled value={user.division} /></div>}
        </div>
      </DashboardCard>
      <DashboardCard title="Where your data lives">
        <p style={{ marginTop: 0 }}>Timetables, requests, bookings, events and notifications are stored on the <strong>TSEC Sync server</strong> and shared by everyone. Permissions are enforced there, not in your browser.</p>
        {user.role === 'management' && oldBrowserData && (
          <p>This browser still holds data saved by the older prototype. You can import it <strong>once</strong>, and only while nobody has made a change on the server yet. <button className="btn btn-outline btn-sm" onClick={() => setConfirm('import')}>Import data from this browser</button></p>
        )}
        {user.role === 'management' && serverConfig.demoReset && <button className="btn btn-outline" onClick={() => setConfirm('reset')}>Reset demo data</button>}
      </DashboardCard>
      {confirm === 'import' && <ConfirmDialog title="Import data from this browser?" confirmLabel="Import" message="This replaces the server's demo data with this browser's data. It is refused if the server already has real activity. Official timetables are kept." onConfirm={importOld} onClose={() => setConfirm(null)} />}
      {confirm === 'reset' && <ConfirmDialog title="Reset ALL data to the demo data?" danger confirmLabel="Reset everything" message="Every request, booking, event, notification and change in the shared state is replaced by demo data. Official timetables stay. This is only available on a demo server." onConfirm={resetDemo} onClose={() => setConfirm(null)} />}
    </div>
  )
}
