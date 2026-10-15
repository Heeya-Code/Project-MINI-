import { useState } from 'react'
import Modal from './Modal'
import ConflictPanel from './ConflictPanel'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { departments, semesters } from '../data/departments'
import { rooms } from '../data/rooms'
import { addDays, toMinutes, todayISO } from '../utils/dates'

// A teacher proposes a seminar (or edits their own pending proposal). It is invisible to students until approved.
export default function SeminarProposalModal({ proposal = null, onClose }) {
  const { actions } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const [f, setF] = useState(() => proposal
    ? { title: proposal.title, speaker: proposal.speaker || '', description: proposal.description || '', date: proposal.date, start: proposal.start, end: proposal.end, roomId: proposal.roomId, deptId: proposal.audience.deptId, semester: proposal.audience.semester }
    : { title: '', speaker: '', description: '', date: addDays(todayISO(), 7), start: '14:00', end: '16:00', roomId: 'Seminar Hall 1', deptId: user.department || 'all', semester: 'all' })
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setFeedback(null) }
  const valid = f.title.trim() && f.date && toMinutes(f.end) > toMinutes(f.start)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const { deptId, semester, ...rest } = f
    const input = { ...rest, audience: { deptId, semester } }
    const res = await (proposal ? actions.updateSeminarProposal({ id: proposal.id, ...input }) : actions.proposeSeminar(input))
    setBusy(false)
    if (!res.ok) { setFeedback(res); toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }
  return (
    <Modal title={proposal ? 'Edit seminar proposal' : 'Propose a seminar'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field field-full"><label htmlFor="sp-title">Title</label><input id="sp-title" value={f.title} onChange={e => set('title', e.target.value)} /></div>
          <div className="field"><label htmlFor="sp-speaker">Speaker (optional)</label><input id="sp-speaker" value={f.speaker} onChange={e => set('speaker', e.target.value)} /></div>
          <div className="field"><label htmlFor="sp-room">Venue</label><select id="sp-room" value={f.roomId} onChange={e => set('roomId', e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.id} — {r.type} ({r.capacity})</option>)}</select></div>
          <div className="field"><label htmlFor="sp-date">Date</label><input id="sp-date" type="date" min={todayISO()} value={f.date} onChange={e => set('date', e.target.value)} /></div>
          <div className="field"><label htmlFor="sp-start">Start</label><input id="sp-start" type="time" value={f.start} onChange={e => set('start', e.target.value)} /></div>
          <div className="field"><label htmlFor="sp-end">End</label><input id="sp-end" type="time" value={f.end} onChange={e => set('end', e.target.value)} /></div>
          <div className="field"><label htmlFor="sp-dept">Audience — department</label><select id="sp-dept" value={f.deptId} onChange={e => set('deptId', e.target.value)}><option value="all">All departments</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="sp-sem">Audience — semester</label><select id="sp-sem" value={f.semester} onChange={e => set('semester', e.target.value)}><option value="all">All semesters</option>{semesters.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="field field-full"><label htmlFor="sp-desc">Description (optional)</label><textarea id="sp-desc" rows={2} value={f.description} onChange={e => set('description', e.target.value)} /></div>
        </div>
        <p className="muted-text">The venue and time are checked for conflicts now and again when the administrator approves. Students are told only after approval.</p>
        {feedback && <ConflictPanel conflicts={feedback.conflicts} alternatives={feedback.alternatives} />}
        <div className="btn-row"><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!valid || busy}>{busy ? 'Sending…' : proposal ? 'Save changes' : 'Send proposal'}</button></div>
      </form>
    </Modal>
  )
}
