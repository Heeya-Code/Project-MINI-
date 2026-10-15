import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import DashboardCard from './DashboardCard'
import EventCard from './EventCard'
import EventForm from './EventForm'
import ConfirmDialog from './ConfirmDialog'
import SeminarProposalModal from './SeminarProposalModal'
import { buildings } from '../data/rooms'
import { roomById } from '../utils/lookup'
import { todayISO } from '../utils/dates'

// Shared by the Events page and the Seminars page. Admins can add / edit / cancel.
export default function EventsBoard({ title, kinds, defaultKind }) {
  const { state, actions } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [building, setBuilding] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [form, setForm] = useState(null) // null | {event?}
  const [cancelling, setCancelling] = useState(null)
  const [proposing, setProposing] = useState(false)
  const today = todayISO()
  const isAdmin = user.role === 'management'

  const list = state.events
    .filter(e => kinds.includes(e.kind))
    .filter(e => e.status !== 'proposed' && e.status !== 'rejected') // proposals live on the Requests page until approved
    .filter(e => (showPast ? e.date < today : e.date >= today))
    .filter(e => !search || `${e.title} ${e.speaker} ${e.committee}`.toLowerCase().includes(search.toLowerCase()))
    .filter(e => !building || roomById(e.roomId)?.building === building)
    .sort((a, b) => (showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))

  return (
    <DashboardCard title={title} action={isAdmin ? <button className="btn btn-brass btn-sm" onClick={() => setForm({})}>+ Add</button> : user.role === 'teacher' && kinds.includes('seminar') ? <button className="btn btn-brass btn-sm" onClick={() => setProposing(true)}>Propose a seminar</button> : null}>
      <div className="filter-bar">
        <input aria-label="Search" placeholder="Search title, speaker, committee…" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Building" value={building} onChange={e => setBuilding(e.target.value)}><option value="">All buildings</option>{buildings.map(b => <option key={b}>{b}</option>)}</select>
        <label className="check"><input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} /> Show past</label>
      </div>
      {list.length === 0 ? <div className="empty-state"><div className="glyph">{'\u2605'}</div>Nothing {showPast ? 'in the past' : 'upcoming'} matches.</div> : (
        <div className="grid grid-3">
          {list.map(ev => <EventCard key={ev.id} event={ev} onEdit={isAdmin ? e => setForm({ event: e }) : undefined} onCancel={isAdmin ? setCancelling : undefined} />)}
        </div>
      )}
      {proposing && <SeminarProposalModal onClose={() => setProposing(false)} />}
      {form && <EventForm event={form.event} defaultKind={defaultKind} onClose={() => setForm(null)} />}
      {cancelling && (
        <ConfirmDialog title={`Cancel “${cancelling.title}”?`} danger requireReason confirmLabel="Cancel event" message="The venue is released and everyone in the audience is notified."
          onConfirm={async reason => { const r = await actions.cancelEvent({ id: cancelling.id, reason }); toast(r.ok ? 'success' : 'error', r.message); setCancelling(null) }} onClose={() => setCancelling(null)} />
      )}
    </DashboardCard>
  )
}
