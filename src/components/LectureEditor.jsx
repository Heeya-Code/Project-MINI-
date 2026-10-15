import { useMemo, useState } from 'react'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import ConflictPanel from './ConflictPanel'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { departments, defaultDivisionFor, divisionOptionsFor, hasDivisions, semesters } from '../data/departments'
import { rooms } from '../data/rooms'
import { facultyPool } from '../data/faculty'
import { subjectBanks, timeSlots } from '../data/timetable'
import { WEEKDAYS, toMinutes } from '../utils/dates'
import { findRecurringConflicts } from '../utils/schedule'
import { classLabel } from '../utils/lookup'

// Admin: add / edit / remove ONE recurring weekly lecture. Other lectures and other
// departments are never touched. (For one-day changes use ChangeLectureModal.)
export default function LectureEditor({ lecture, defaults, onClose }) {
  const { state, actions } = useData()
  const toast = useToast()
  const editing = !!lecture
  const [f, setF] = useState(() => lecture
    ? { deptId: lecture.deptId, semester: lecture.semester, division: lecture.division, subject: lecture.subject, faculty: lecture.faculty, weekday: lecture.weekday, start: lecture.start, end: lecture.end, roomId: lecture.roomId, reason: '' }
    : { deptId: defaults.deptId, semester: defaults.semester, division: defaults.division, subject: '', faculty: facultyPool[defaults.deptId][0], weekday: 'Monday', start: timeSlots[0].start, end: timeSlots[0].end, roomId: rooms[0].id, reason: '' })
  const [feedback, setFeedback] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setFeedback(null) }

  const valid = f.subject.trim() && toMinutes(f.end) > toMinutes(f.start) && (!editing || f.reason.trim())
  const preview = useMemo(() => {
    if (toMinutes(f.end) <= toMinutes(f.start)) return null
    return findRecurringConflicts(state, { ...f, division: hasDivisions(f.deptId) ? f.division : '' }, lecture?.id)
  }, [state, f, lecture])
  const subjects = subjectBanks[f.deptId]?.[f.semester]?.map(s => s.name) || []
  const facultyOptions = [...new Set([f.faculty, ...(facultyPool[f.deptId] || [])])]

  async function submit(e) {
    e.preventDefault()
    const res = await actions.saveLecture({ ...f, division: hasDivisions(f.deptId) ? f.division : '', id: lecture?.id })
    if (!res.ok) { setFeedback(res); toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }
  async function remove(reason) {
    const res = await actions.deleteLecture({ id: lecture.id, reason })
    setConfirmDelete(false)
    if (!res.ok) { toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }

  const shownConflicts = feedback?.conflicts || preview
  return (
    <Modal title={editing ? `Edit recurring lecture — ${classLabel(lecture)}` : 'Add recurring lecture'} onClose={onClose} wide>
      <p className="tt-cell-meta" style={{ marginTop: 0 }}>
        This changes the <strong>regular weekly timetable</strong> for this lecture only. To change just one date, use “Change this date”.
      </p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="le-dept">Department</label>
            <select id="le-dept" value={f.deptId} disabled={editing} onChange={e => setF(x => ({ ...x, deptId: e.target.value, division: defaultDivisionFor(e.target.value), faculty: facultyPool[e.target.value][0] }))}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="le-sem">Semester</label>
            <select id="le-sem" value={f.semester} disabled={editing} onChange={e => set('semester', e.target.value)}>{semesters.map(s => <option key={s}>{s}</option>)}</select></div>
          {hasDivisions(f.deptId) && <div className="field"><label htmlFor="le-div">Division</label>
            <select id="le-div" value={f.division} disabled={editing} onChange={e => set('division', e.target.value)}>{divisionOptionsFor(f.deptId, f.semester).map(d => <option key={d}>{d}</option>)}</select></div>}
          <div className="field"><label htmlFor="le-sub">Subject</label>
            <input id="le-sub" list="le-subjects" value={f.subject} onChange={e => set('subject', e.target.value)} />
            <datalist id="le-subjects">{subjects.map(s => <option key={s} value={s} />)}</datalist></div>
          <div className="field"><label htmlFor="le-fac">Faculty</label>
            <select id="le-fac" value={f.faculty} onChange={e => set('faculty', e.target.value)}>{facultyOptions.map(n => <option key={n}>{n}</option>)}</select></div>
          <div className="field"><label htmlFor="le-day">Day</label>
            <select id="le-day" value={f.weekday} onChange={e => set('weekday', e.target.value)}>{WEEKDAYS.map(d => <option key={d}>{d}</option>)}</select></div>
          <div className="field"><label htmlFor="le-start">Start</label><input id="le-start" type="time" value={f.start} onChange={e => set('start', e.target.value)} /></div>
          <div className="field"><label htmlFor="le-end">End</label><input id="le-end" type="time" value={f.end} onChange={e => set('end', e.target.value)} /></div>
          <div className="field field-full"><label htmlFor="le-room">Room</label>
            <select id="le-room" value={f.roomId} onChange={e => set('roomId', e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.id} — {r.type} — {r.building}, {r.floor}</option>)}</select></div>
          {editing && <div className="field field-full"><label htmlFor="le-reason">Reason for the change (required)</label>
            <textarea id="le-reason" rows={2} value={f.reason} onChange={e => set('reason', e.target.value)} /></div>}
        </div>
        <ConflictPanel conflicts={shownConflicts} alternatives={feedback?.alternatives} onUseRoom={r => set('roomId', r.id)} title="Timetable Conflict" />
        <div className="btn-row">
          {editing && <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Remove from timetable</button>}
          <button type="submit" className="btn btn-brass" disabled={!valid || shownConflicts?.length > 0}>{editing ? 'Save & publish' : 'Add lecture'}</button>
        </div>
      </form>
      {confirmDelete && <ConfirmDialog title="Remove this lecture?" danger requireReason confirmLabel="Remove" message={`${lecture.subject} will be removed from the weekly timetable for ${classLabel(lecture)}, and students will be notified.`} onConfirm={remove} onClose={() => setConfirmDelete(false)} />}
    </Modal>
  )
}
