import { useMemo, useState } from 'react'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import ConflictPanel from './ConflictPanel'
import LectureEntry from './LectureEntry'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { rooms } from '../data/rooms'
import { getExtraRooms } from '../utils/lookup'
import { allFaculty } from '../data/faculty'
import { entryFor, findConflicts, sameSlotValues, suggestAlternatives } from '../utils/schedule'
import { teacherNeedsApproval } from '../utils/permissions'
import { formatDate, todayISO, toMinutes } from '../utils/dates'

// Date-specific change of ONE lecture occurrence (room / building / time / date, and
// for admins also faculty). The regular weekly timetable is never modified here.
export default function ChangeLectureModal({ entry, onClose }) {
  const { state, actions } = useData()
  const { user } = useAuth()
  const toast = useToast()
  const lecture = entry.lecture
  const date = entry.originalDate
  const current = entryFor(state, lecture, date)
  const base = current.status === 'cancelled' ? current.original : current.effective
  const isAdmin = user.role === 'management'

  const [form, setForm] = useState({ newDate: base.date, newStart: base.start, newEnd: base.end, newRoomId: base.roomId, newFaculty: base.faculty, reason: '' })
  const [serverFeedback, setServerFeedback] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setServerFeedback(null) }

  const validTimes = form.newStart && form.newEnd && toMinutes(form.newEnd) > toMinutes(form.newStart)
  // Live check, BEFORE the user submits.
  const preview = useMemo(() => {
    if (!validTimes) return null
    const cand = { date: form.newDate, start: form.newStart, end: form.newEnd, roomId: form.newRoomId, faculty: form.newFaculty, deptId: lecture.deptId, semester: lecture.semester, division: lecture.division }
    const ignore = { source: 'lecture', id: lecture.id }
    const conflicts = findConflicts(state, cand, ignore)
    return { conflicts, alternatives: conflicts.length ? suggestAlternatives(state, cand, ignore) : null }
  }, [state, form, lecture, validTimes])

  const unchanged = current.status !== 'cancelled' && sameSlotValues(current.effective, { date: form.newDate, start: form.newStart, end: form.newEnd, roomId: form.newRoomId, faculty: form.newFaculty })
  const onlyRoom = form.newDate === date && form.newStart === lecture.start && form.newEnd === lecture.end && form.newFaculty === lecture.faculty
  const needsApproval = !isAdmin && teacherNeedsApproval(state.settings, onlyRoom ? 'roomChange' : 'reschedule')
  const cancelNeedsApproval = !isAdmin && teacherNeedsApproval(state.settings, 'cancel')
  const hasException = !!current.exception

  async function submit(e) {
    e.preventDefault()
    const res = await actions.changeLecture({ lectureId: lecture.id, date, ...form })
    if (!res.ok) { setServerFeedback(res); toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }
  async function doCancel(reason) {
    const res = await actions.cancelLecture({ lectureId: lecture.id, date, reason })
    setConfirmCancel(false)
    if (!res.ok) { toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }
  async function doRestore() {
    const res = await actions.restoreLecture({ lectureId: lecture.id, date, reason: 'Regular schedule restored' })
    if (!res.ok) { toast('error', res.message); return }
    toast('success', res.message)
    onClose()
  }

  const shown = serverFeedback?.conflicts?.length ? serverFeedback : preview
  return (
    <Modal title={`Change lecture — ${formatDate(date)}`} onClose={onClose} wide>
      <LectureEntry entry={current} showClass />
      <form onSubmit={submit} style={{ marginTop: 14 }}>
        <div className="form-grid">
          <div className="field"><label htmlFor="cl-date">Date</label><input id="cl-date" type="date" min={todayISO()} value={form.newDate} onChange={e => set('newDate', e.target.value)} /></div>
          <div className="field">
            <label htmlFor="cl-room">Room / lab</label>
            <select id="cl-room" value={form.newRoomId} onChange={e => set('newRoomId', e.target.value)}>
              {[...rooms, ...getExtraRooms()].map(r => <option key={r.id} value={r.id}>{[r.id, r.type, [r.building, r.floor].filter(Boolean).join(', ')].join(' — ')}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="cl-start">Start time</label><input id="cl-start" type="time" value={form.newStart} onChange={e => set('newStart', e.target.value)} /></div>
          <div className="field"><label htmlFor="cl-end">End time</label><input id="cl-end" type="time" value={form.newEnd} onChange={e => set('newEnd', e.target.value)} /></div>
          {isAdmin && (
            <div className="field field-full">
              <label htmlFor="cl-fac">Faculty (replacement for this date)</label>
              <select id="cl-fac" value={form.newFaculty} onChange={e => set('newFaculty', e.target.value)}>
                {[...new Set([lecture.faculty, ...allFaculty])].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          )}
          <div className="field field-full">
            <label htmlFor="cl-reason">Reason for the change (required)</label>
            <textarea id="cl-reason" rows={2} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="e.g. Projector not working in the original room" />
          </div>
        </div>

        {!validTimes && <div className="form-msg form-msg-error">End time must be after start time.</div>}
        {validTimes && preview && preview.conflicts.length === 0 && !unchanged && <div className="form-msg form-msg-success">{'\u2705'} No conflicts — {form.newRoomId} is free for this time.</div>}
        <ConflictPanel conflicts={shown?.conflicts} alternatives={shown?.alternatives}
          onUseRoom={r => set('newRoomId', r.id)}
          onUseSlot={s => setForm(f => ({ ...f, newDate: s.date, newStart: s.start, newEnd: s.end, newRoomId: s.roomId }))} />
        {needsApproval && <div className="form-msg form-msg-info">This change needs administrator approval before it is published. Students are notified only after approval.</div>}

        <div className="btn-row">
          {isAdmin && hasException && <button type="button" className="btn btn-outline" onClick={doRestore}>Restore regular schedule</button>}
          {current.status !== 'cancelled' && <button type="button" className="btn btn-danger" onClick={() => setConfirmCancel(true)}>{cancelNeedsApproval ? 'Request cancellation' : 'Cancel lecture'}</button>}
          <button type="submit" className="btn btn-brass" disabled={!validTimes || unchanged || !form.reason.trim() || preview?.conflicts.length > 0}>
            {needsApproval ? 'Submit for approval' : 'Publish change'}
          </button>
        </div>
      </form>
      {confirmCancel && (
        <ConfirmDialog title="Cancel this lecture?" danger requireReason confirmLabel={cancelNeedsApproval ? 'Send request' : 'Cancel lecture'}
          message={`${lecture.subject} on ${formatDate(date)} will be cancelled for this date only.${cancelNeedsApproval ? ' An administrator must approve it first.' : ' Students will be notified.'}`}
          onConfirm={doCancel} onClose={() => setConfirmCancel(false)} />
      )}
    </Modal>
  )
}
