import { useMemo, useState } from 'react'
import Modal from './Modal'
import ConflictPanel from './ConflictPanel'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { departments, semesters } from '../data/departments'
import { rooms } from '../data/rooms'
import { findEventConflicts, suggestAlternatives, suggestMoveForEntry } from '../utils/schedule'
import { eventKinds } from '../utils/lookup'
import { nextWorkingDay, todayISO, toMinutes } from '../utils/dates'

const orderedRooms = [...rooms].sort((a, b) => Number(b.type === 'Seminar Hall') - Number(a.type === 'Seminar Hall'))

// Admin: create / edit a seminar or event. Conflicts are detected live, and the admin
// can resolve each one explicitly (move / cancel the clashing item). Nothing is ever
// cancelled or overwritten automatically.
export default function EventForm({ event = null, defaultKind = 'seminar', onClose }) {
  const { state, actions } = useData()
  const toast = useToast()
  const [f, setF] = useState(() => event
    ? { ...event, audienceDept: event.audience.deptId, audienceSem: event.audience.semester }
    : { kind: defaultKind, title: '', speaker: '', committee: '', description: '', date: nextWorkingDay(todayISO()), start: '11:00', end: '13:00', roomId: 'Seminar Hall 2', seatsTotal: 120, audienceDept: 'all', audienceSem: 'all', attendanceRequired: false })
  const [feedback, setFeedback] = useState(null)
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setFeedback(null) }

  const draftEvent = useMemo(() => ({ ...f, audience: { deptId: f.audienceDept, semester: f.audienceSem } }), [f])
  const timesOk = f.start && f.end && toMinutes(f.end) > toMinutes(f.start)
  const conflicts = useMemo(() => (timesOk && f.date ? findEventConflicts(state, draftEvent, event?.id) : []), [state, draftEvent, timesOk, f.date, event])
  const alternatives = useMemo(() => {
    if (!conflicts.length) return null
    return suggestAlternatives(state, { date: f.date, start: f.start, end: f.end, roomId: f.roomId, minCapacity: Math.min(Number(f.seatsTotal) || 0, rooms.find(r => r.id === f.roomId)?.capacity || 0) }, { source: 'event', id: event?.id || '__draft__' })
  }, [state, conflicts, f, event])

  const reasonFor = `Needed for "${f.title || 'upcoming event'}"`
  function resolveButtons(c) {
    const b = c.block
    if (b.source === 'booking') {
      return <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
        const r = await actions.cancelBooking({ id: b.id, reason: `${reasonFor} — venue required` })
        toast(r.ok ? 'success' : 'error', r.ok ? 'Booking cancelled by administrator.' : r.message)
      }}>Cancel that booking</button>
    }
    if (b.source === 'lecture') {
      const move = suggestMoveForEntry(state, b.entry, c.type, draftEvent)
      return (
        <div className="chip-row">
          {move && <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
            const r = await actions.changeLecture({ lectureId: b.entry.lecture.id, date: b.entry.originalDate, ...move, reason: reasonFor })
            toast(r.ok ? 'success' : 'error', r.ok ? 'Lecture moved and students notified.' : r.message)
          }}>{move.label}</button>}
          <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
            const r = await actions.cancelLecture({ lectureId: b.entry.lecture.id, date: b.entry.originalDate, reason: reasonFor })
            toast(r.ok ? 'success' : 'error', r.ok ? 'Lecture cancelled for that date.' : r.message)
          }}>Cancel that lecture</button>
        </div>
      )
    }
    return <span className="tt-cell-meta">Pick another hall or time (see suggestions below).</span>
  }

  async function submit(e) {
    e.preventDefault()
    const res = await actions.saveEvent({ ...draftEvent, id: event?.id })
    if (!res.ok) { setFeedback(res); toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }

  const complete = timesOk && f.title.trim() && f.committee.trim() && f.date
  return (
    <Modal title={event ? `Edit ${eventKinds[f.kind]}` : 'Add seminar / event'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="ef-kind">Type</label>
            <select id="ef-kind" value={f.kind} onChange={e => set('kind', e.target.value)}>{Object.entries(eventKinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label htmlFor="ef-title">Title</label><input id="ef-title" value={f.title} onChange={e => set('title', e.target.value)} placeholder="AI and Future Technology Seminar" /></div>
          <div className="field"><label htmlFor="ef-speaker">Speaker (optional)</label><input id="ef-speaker" value={f.speaker} onChange={e => set('speaker', e.target.value)} /></div>
          <div className="field"><label htmlFor="ef-committee">Organizing committee</label><input id="ef-committee" value={f.committee} onChange={e => set('committee', e.target.value)} /></div>
          <div className="field"><label htmlFor="ef-date">Date</label><input id="ef-date" type="date" min={todayISO()} value={f.date} onChange={e => set('date', e.target.value)} /></div>
          <div className="field"><label htmlFor="ef-room">Venue</label>
            <select id="ef-room" value={f.roomId} onChange={e => set('roomId', e.target.value)}>{orderedRooms.map(r => <option key={r.id} value={r.id}>{r.id} — {r.building}, {r.floor} ({r.capacity} seats)</option>)}</select></div>
          <div className="field"><label htmlFor="ef-start">Start time</label><input id="ef-start" type="time" value={f.start} onChange={e => set('start', e.target.value)} /></div>
          <div className="field"><label htmlFor="ef-end">End time</label><input id="ef-end" type="time" value={f.end} onChange={e => set('end', e.target.value)} /></div>
          <div className="field"><label htmlFor="ef-adept">Audience department</label>
            <select id="ef-adept" value={f.audienceDept} onChange={e => set('audienceDept', e.target.value)}><option value="all">All departments</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="ef-asem">Audience semester</label>
            <select id="ef-asem" value={f.audienceSem} onChange={e => set('audienceSem', e.target.value)}><option value="all">All semesters</option>{semesters.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="field"><label htmlFor="ef-seats">Seats</label><input id="ef-seats" type="number" min="1" value={f.seatsTotal} onChange={e => set('seatsTotal', e.target.value)} /></div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="check"><input type="checkbox" checked={f.attendanceRequired} onChange={e => set('attendanceRequired', e.target.checked)} /> Attendance compulsory (flags overlapping lectures of the audience)</label></div>
          <div className="field field-full"><label htmlFor="ef-desc">Description</label><textarea id="ef-desc" rows={2} value={f.description} onChange={e => set('description', e.target.value)} /></div>
        </div>
        {!timesOk && <div className="form-msg form-msg-error">End time must be after start time.</div>}
        <ConflictPanel conflicts={feedback?.conflicts?.length ? feedback.conflicts : conflicts} alternatives={feedback?.alternatives || alternatives}
          renderResolve={resolveButtons} onUseRoom={r => set('roomId', r.id)} onUseSlot={s => setF(x => ({ ...x, date: s.date, start: s.start, end: s.end, roomId: s.roomId }))} />
        {conflicts.length > 0 && <div className="form-msg form-msg-info">Nothing is cancelled automatically. Choose another hall/time, or resolve each clash above with your administrator authority, then save.</div>}
        <div className="btn-row"><button type="submit" className="btn btn-brass" disabled={!complete || conflicts.length > 0}>{event ? 'Save changes' : 'Create & announce'}</button></div>
      </form>
    </Modal>
  )
}
