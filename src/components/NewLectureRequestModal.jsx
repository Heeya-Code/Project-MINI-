import { useState } from 'react'
import Modal from './Modal'
import ConflictPanel from './ConflictPanel'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { departments, divisionOptionsFor, hasDivisions, semesters, days } from '../data/departments'
import { rooms } from '../data/rooms'
import { toMinutes } from '../utils/dates'

// A teacher asks for a NEW weekly lecture. The server re-checks everything and tells the administrator.
export default function NewLectureRequestModal({ onClose }) {
  const { actions } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ deptId: user.department || departments[0].id, semester: 'SEM III', division: '', subject: '', weekday: 'Monday', start: '10:00', end: '11:00', roomId: rooms[0].id, reason: '' })
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const options = divisionOptionsFor(f.deptId, f.semester)
  const division = hasDivisions(f.deptId) ? (options.includes(f.division) ? f.division : options[0]) : '' // EXTC / Chemistry: no division
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setFeedback(null) }
  const valid = f.subject.trim() && f.reason.trim() && toMinutes(f.end) > toMinutes(f.start)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const res = await actions.requestNewLecture({ ...f, division })
    setBusy(false)
    if (!res.ok) { setFeedback(res); toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }
  return (
    <Modal title="Request a new lecture" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="nl-dept">Department</label><select id="nl-dept" value={f.deptId} onChange={e => set('deptId', e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="nl-sem">Semester</label><select id="nl-sem" value={f.semester} onChange={e => set('semester', e.target.value)}>{semesters.map(s => <option key={s}>{s}</option>)}</select></div>
          {hasDivisions(f.deptId) && <div className="field"><label htmlFor="nl-div">Division</label><select id="nl-div" value={division} onChange={e => set('division', e.target.value)}>{options.map(d => <option key={d}>{d}</option>)}</select></div>}
          <div className="field"><label htmlFor="nl-subject">Subject</label><input id="nl-subject" value={f.subject} onChange={e => set('subject', e.target.value)} /></div>
          <div className="field"><label htmlFor="nl-day">Weekday</label><select id="nl-day" value={f.weekday} onChange={e => set('weekday', e.target.value)}>{days.map(d => <option key={d}>{d}</option>)}</select></div>
          <div className="field"><label htmlFor="nl-room">Room</label><select id="nl-room" value={f.roomId} onChange={e => set('roomId', e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.id} — {r.type}</option>)}</select></div>
          <div className="field"><label htmlFor="nl-start">Start</label><input id="nl-start" type="time" value={f.start} onChange={e => set('start', e.target.value)} /></div>
          <div className="field"><label htmlFor="nl-end">End</label><input id="nl-end" type="time" value={f.end} onChange={e => set('end', e.target.value)} /></div>
          <div className="field field-full"><label htmlFor="nl-reason">Reason</label><textarea id="nl-reason" rows={2} value={f.reason} onChange={e => set('reason', e.target.value)} /></div>
        </div>
        <p className="muted-text">You are the assigned faculty. Nothing changes until an administrator approves, and you will be notified of the decision.</p>
        {feedback && <ConflictPanel conflicts={feedback.conflicts} alternatives={feedback.alternatives} />}
        <div className="btn-row"><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!valid || busy}>{busy ? 'Sending…' : 'Send request'}</button></div>
      </form>
    </Modal>
  )
}
