import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import DashboardCard from '../components/DashboardCard'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import BookingForm from '../components/BookingForm'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatDate, formatRange, nowHHMM, todayISO, toMinutes } from '../utils/dates'
import { roomById } from '../utils/lookup'

// Display status: an approved booking whose time has passed is "completed".
export function bookingStatus(b, today = todayISO(), now = nowHHMM()) {
  if (b.status === 'approved' && (b.date < today || (b.date === today && toMinutes(b.end) <= toMinutes(now)))) return 'completed'
  return b.status
}
const TABS = ['all', 'pending', 'approved', 'rejected', 'completed', 'cancelled']

export default function BookingsPage() {
  const { user } = useAuth()
  const { state, actions } = useData()
  const toast = useToast()
  const isAdmin = user.role === 'management'
  const [tab, setTab] = useState('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [search, setSearch] = useState('')

  const mine = state.bookings.filter(b => isAdmin || b.createdBy?.email === user.email)
  const rows = mine
    .map(b => ({ b, st: bookingStatus(b) }))
    .filter(({ b, st }) => (tab === 'all' || st === tab) && (!search || `${b.purpose} ${b.roomId} ${b.faculty}`.toLowerCase().includes(search.toLowerCase())))
    .sort((x, y) => y.b.date.localeCompare(x.b.date) || y.b.start.localeCompare(x.b.start))

  const done = async p => { const r = await p; toast(r.ok ? 'success' : 'error', r.message) }

  return (
    <DashboardCard title={isAdmin ? 'All Room Bookings' : 'My Bookings'} action={<button className="btn btn-brass btn-sm" onClick={() => setCreating(true)}>+ Book a room</button>}>
      <div className="tabs" role="tablist">
        {TABS.map(t => <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} ({t === 'all' ? mine.length : mine.filter(b => bookingStatus(b) === t).length})</button>)}
      </div>
      <div className="filter-bar"><input aria-label="Search bookings" placeholder="Search purpose, room, faculty…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {rows.length === 0 && <div className="empty-state"><div className="glyph">{'\u2637'}</div>No bookings here yet.</div>}
      <div className="stack-sm">
        {rows.map(({ b, st }) => (
          <div className="booking-row" key={b.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{b.purpose}</strong>
              <div className="tt-cell-meta">{b.roomId} · {roomById(b.roomId)?.building} · {formatDate(b.date)} · {formatRange(b.start, b.end)}</div>
              <div className="tt-cell-meta">{b.faculty}{b.decision?.reason ? ` · ${st === 'rejected' ? 'Rejected' : 'Note'}: ${b.decision.reason}` : ''}</div>
            </div>
            <StatusBadge status={st} />
            <div className="row-actions">
              {isAdmin && st === 'pending' && <>
                <button className="btn btn-primary btn-sm" onClick={() => done(actions.decideBooking({ id: b.id, decision: 'approve' }))}>Approve</button>
                <button className="btn btn-outline btn-sm" onClick={() => setRejecting(b)}>Reject</button>
              </>}
              {(st === 'pending' || st === 'approved') && <button className="btn btn-outline btn-sm" onClick={() => setEditing(b)}>Edit</button>}
              {(st === 'pending' || st === 'approved') && <button className="btn btn-danger btn-sm" onClick={() => setCancelling(b)}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
      {creating && <Modal title="Book a Room / Lab / Seminar Hall" onClose={() => setCreating(false)} wide><BookingForm onDone={() => setCreating(false)} /></Modal>}
      {editing && <Modal title="Edit booking" onClose={() => setEditing(null)} wide><BookingForm booking={editing} onDone={() => setEditing(null)} /></Modal>}
      {cancelling && <ConfirmDialog title="Cancel this booking?" danger requireReason confirmLabel="Cancel booking" message={`${cancelling.roomId} on ${formatDate(cancelling.date)} will be released.`}
        onConfirm={reason => { done(actions.cancelBooking({ id: cancelling.id, reason })); setCancelling(null) }} onClose={() => setCancelling(null)} />}
      {rejecting && <ConfirmDialog title="Reject this booking?" danger requireReason reasonLabel="Reason for rejection" confirmLabel="Reject"
        message={`${rejecting.createdBy.name} will be told why.`} onConfirm={reason => { done(actions.decideBooking({ id: rejecting.id, decision: 'reject', note: reason })); setRejecting(null) }} onClose={() => setRejecting(null)} />}
    </DashboardCard>
  )
}
