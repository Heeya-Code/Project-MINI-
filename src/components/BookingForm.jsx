import { useMemo, useState } from 'react'
import ConflictPanel from './ConflictPanel'
import { departments } from '../data/departments'
import { rooms } from '../data/rooms'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { findConflicts, suggestAlternatives } from '../utils/schedule'
import { todayISO, toMinutes } from '../utils/dates'
import { roomById } from '../utils/lookup'

// Create (or, when `booking` is passed, edit) a room / lab / seminar-hall booking.
// The availability check runs LIVE as you type, using the same engine the server-side
// operation uses, so what you see is what will happen on submit.
export default function BookingForm({ booking = null, onDone }) {
  const { state, actions } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState(() => booking
    ? { roomId: booking.roomId, date: booking.date, start: booking.start, end: booking.end, purpose: booking.purpose, faculty: booking.faculty, deptId: booking.deptId || departments[0].id }
    : { roomId: rooms[0].id, date: todayISO(), start: '16:00', end: '17:00', purpose: '', faculty: user.role === 'teacher' ? user.name : '', deptId: user.department || departments[0].id })
  const [feedback, setFeedback] = useState(null)
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setFeedback(null) }

  const timesOk = f.start && f.end && toMinutes(f.end) > toMinutes(f.start)
  const room = roomById(f.roomId)
  const check = useMemo(() => {
    if (!timesOk || !f.date) return null
    const cand = { date: f.date, start: f.start, end: f.end, roomId: f.roomId, faculty: f.faculty || null }
    const ignore = booking ? { source: 'booking', id: booking.id } : null
    const conflicts = findConflicts(state, cand, ignore)
    return { conflicts, alternatives: conflicts.length ? suggestAlternatives(state, cand, ignore) : null }
  }, [state, f, timesOk, booking])

  const needsApproval = user.role === 'teacher' && room?.type === 'Seminar Hall' && state.settings.seminarHallBooking === 'approval'
  const complete = timesOk && f.purpose.trim() && f.faculty.trim() && f.date

  async function submit(e) {
    e.preventDefault()
    const res = await (booking ? actions.updateBooking({ id: booking.id, ...f }) : actions.createBooking(f))
    if (!res.ok) { setFeedback(res); toast('error', res.message); return }
    toast('success', res.message)
    onDone?.()
  }

  const shown = feedback?.conflicts?.length ? feedback : check
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field"><label htmlFor="bf-dept">Department</label>
          <select id="bf-dept" value={f.deptId} onChange={e => set('deptId', e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="field"><label htmlFor="bf-date">Date</label><input id="bf-date" type="date" min={todayISO()} value={f.date} onChange={e => set('date', e.target.value)} /></div>
        <div className="field"><label htmlFor="bf-start">Start time</label><input id="bf-start" type="time" value={f.start} onChange={e => set('start', e.target.value)} /></div>
        <div className="field"><label htmlFor="bf-end">End time</label><input id="bf-end" type="time" value={f.end} onChange={e => set('end', e.target.value)} /></div>
        <div className="field"><label htmlFor="bf-room">Room / lab / hall</label>
          <select id="bf-room" value={f.roomId} onChange={e => set('roomId', e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.id} — {r.type}</option>)}</select></div>
        <div className="field"><label htmlFor="bf-building">Building</label><input id="bf-building" value={`${room?.building || ''} · ${room?.floor || ''}`} disabled /></div>
        <div className="field field-full"><label htmlFor="bf-purpose">Purpose</label><input id="bf-purpose" value={f.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. Extra lecture — Database Management" /></div>
        <div className="field field-full"><label htmlFor="bf-fac">Faculty name</label><input id="bf-fac" value={f.faculty} disabled={user.role === 'teacher'} onChange={e => set('faculty', e.target.value)} /></div>
      </div>

      {!timesOk && <div className="form-msg form-msg-error">End time must be after start time.</div>}
      {check && check.conflicts.length === 0 && <div className="form-msg form-msg-success">{'\u2705'} <strong>Room Available</strong> — {f.roomId} is available for the selected time.</div>}
      {shown?.conflicts?.length > 0 && <div className="form-msg form-msg-error">{'\u274C'} <strong>Booking Conflict</strong> — This room is already occupied during the selected time.</div>}
      <ConflictPanel conflicts={shown?.conflicts} alternatives={shown?.alternatives} onUseRoom={r => set('roomId', r.id)} onUseSlot={s => setF(x => ({ ...x, date: s.date, start: s.start, end: s.end, roomId: s.roomId }))} title="Why this slot is unavailable" />
      {needsApproval && <div className="form-msg form-msg-info">Seminar hall bookings need administrator approval. The room is only reserved once it is approved.</div>}

      <button type="submit" className="btn btn-brass" style={{ marginTop: 16, width: '100%' }} disabled={!complete || shown?.conflicts?.length > 0}>
        {booking ? 'Save changes' : needsApproval ? 'Request booking' : 'Confirm booking'}
      </button>
    </form>
  )
}
