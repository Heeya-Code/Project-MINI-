// ============================================================================
// STORE OPERATIONS — every change to timetable data goes through here.
//
// Each operation is a PURE function:   (state, actor, input, ctx) -> { state, result }
//   * it checks the actor's permission,
//   * validates the input,
//   * runs the shared conflict engine (utils/schedule.js),
//   * and only then returns a NEW state (notification + audit entry included).
// If anything fails, the old state is returned untouched and result.ok === false.
// Keeping them pure makes them easy to unit-test and easy to move behind a real
// API later (each function becomes one endpoint).
// ============================================================================
import { WEEKDAYS, addDays, formatDate, formatRange, isWorkingDay, todayISO, toMinutes, weekdayOf } from '../utils/dates.js'
import { departments } from '../data/departments.js'
import { rooms } from '../data/rooms.js'
import { timeSlots } from '../data/timetable.js'
import {
  conflictSummary, entryFor, findConflicts, findEventConflicts, findRecurringConflicts,
  getDaySchedule, rangesOverlap, sameSlotValues, suggestAlternatives,
} from '../utils/schedule.js'
import { classLabel, deptName, deptShort, eventKindLabel, roomById, roomLabel } from '../utils/lookup.js'
import { describeLectureChange, diffLecture, snapshot } from '../utils/changeDetection.js'
import { audienceForEvent, audienceForLecture, categoryFor, defaultLink } from '../utils/notifications.js'
import { isValidClass } from '../data/departments.js'
import { can, teacherNeedsApproval } from '../utils/permissions.js'

const fail = (message, extra = {}) => ({ ok: false, message, ...extra })
const ret = (state, result) => ({ state, result })
const nowISO = () => new Date().toISOString()
const draft = state => ({ ...state })

function nextId(s, prefix) {
  s.seq = (s.seq || 0) + 1
  return `${prefix}${s.seq}`
}
function audit(s, actor, action, summary, reason = '') {
  s.audit = [{ id: nextId(s, 'a'), at: nowISO(), by: actor.name, role: actor.role, action, summary, reason }, ...s.audit]
}
function notify(s, n) {
  // A notification with a dedupeKey is only ever stored once (retries / duplicate calls are harmless).
  if (n.dedupeKey && s.notifications.some(x => x.dedupeKey === n.dedupeKey)) return
  const base = { id: nextId(s, 'n'), createdAt: nowISO(), ...n }
  base.category = categoryFor(base)
  base.link = n.link || defaultLink(base)
  s.notifications = [base, ...s.notifications]
}
const OFFICIAL_MSG = 'This lecture comes from an official published timetable. Change it in Timetable Uploads (create an editable draft and publish it); one-day changes and cancellations still work from the timetable.'
const REQUEST_LABEL = { cancel: 'lecture cancellation', roomChange: 'room change', reschedule: 'lecture reschedule', facultyChange: 'faculty change', add: 'new lecture' }
const describeChanges = changes => changes.map(c => `${c.field}: ${c.from} → ${c.to}`).join('; ')

// ----------------------------------------------------------------------------
// LECTURE CHANGES (one date only — the recurring timetable is NOT modified)
// ----------------------------------------------------------------------------
function checkProposal(state, lecture, p, today) {
  if (!p.newStart || !p.newEnd || toMinutes(p.newEnd) <= toMinutes(p.newStart)) return fail('End time must be after start time.')
  if (!roomById(p.newRoomId)) return fail('Please choose a valid room.')
  if (!isWorkingDay(p.newDate)) return fail('Lectures can only be scheduled Monday to Friday.')
  if (p.newDate < today) return fail('A lecture cannot be moved to a past date.')
  const cand = {
    date: p.newDate, start: p.newStart, end: p.newEnd, roomId: p.newRoomId, faculty: p.newFaculty,
    deptId: lecture.deptId, semester: lecture.semester, division: lecture.division, batch: lecture.batch || '', kind: lecture.kind || 'lecture',
  }
  const ignore = { source: 'lecture', id: lecture.id }
  const conflicts = findConflicts(state, cand, ignore)
  if (conflicts.length) return fail(conflictSummary(conflicts), { conflicts, alternatives: suggestAlternatives(state, cand, ignore) })
  return null
}

function applyException(s, actor, { lecture, date, type, proposal, reason, requestedBy, quiet }) {
  const ex = {
    id: nextId(s, 'ex'), lectureId: lecture.id, originalDate: date, type, reason, status: 'published',
    createdBy: requestedBy?.name || actor.name, approvedBy: requestedBy ? actor.name : null, createdAt: nowISO(),
  }
  if (type === 'change') Object.assign(ex, proposal)
  s.exceptions = [...s.exceptions.filter(e => !(e.lectureId === lecture.id && e.originalDate === date)), ex]

  const original = { date, start: lecture.start, end: lecture.end, roomId: lecture.roomId, faculty: lecture.faculty }
  const updated = type === 'change'
    ? { date: ex.newDate, start: ex.newStart, end: ex.newEnd, roomId: ex.newRoomId, faculty: ex.newFaculty || lecture.faculty }
    : original
  const desc = describeLectureChange({ subject: lecture.subject, original, updated, cancelled: type === 'cancel', reason })
  notify(s, { ...desc, audience: audienceForLecture(lecture, [updated.faculty]), lectureId: lecture.id, publishedBy: actor.name })
  if (!quiet) {
    audit(s, actor, type === 'cancel' ? 'lecture.cancel' : 'lecture.change',
      `${lecture.subject} (${classLabel(lecture)}) on ${formatDate(date)} — ${describeChanges(desc.changes)}`, reason)
  }
  return desc
}

export function submitLectureChange(state, actor, input, ctx = {}) {
  const today = ctx.today || todayISO()
  const type = input.type === 'cancel' ? 'cancel' : 'change'
  const lecture = state.lectures.find(l => l.id === input.lectureId)
  if (!lecture) return ret(state, fail('Lecture not found.'))
  if (lecture.inactive) return ret(state, fail('This lecture is no longer part of an active timetable.'))
  if (!can(actor, type === 'cancel' ? 'lecture.cancel' : 'lecture.change', { lecture })) {
    return ret(state, fail('You do not have permission to change this lecture.'))
  }
  const reason = (input.reason || '').trim()
  if (!reason) return ret(state, fail('Please enter a reason for this change.'))
  const date = input.date
  if (!isWorkingDay(date) || weekdayOf(date) !== lecture.weekday) return ret(state, fail('This lecture does not run on the selected date.'))
  if (date < today) return ret(state, fail('Past lectures cannot be changed.'))

  const current = entryFor(state, lecture, date)
  let proposal = {}
  let kind = 'cancel'
  if (type === 'cancel') {
    if (current.status === 'cancelled') return ret(state, fail('This lecture is already cancelled for that date.'))
  } else {
    proposal = {
      newDate: input.newDate || date, newStart: input.newStart || lecture.start, newEnd: input.newEnd || lecture.end,
      newRoomId: input.newRoomId || lecture.roomId, newFaculty: input.newFaculty || lecture.faculty,
    }
    if (typeof proposal.newFaculty !== 'string' || !proposal.newFaculty.trim() || proposal.newFaculty.length > 100) return ret(state, fail('Please enter a valid faculty name.'))
    const asValues = { date: proposal.newDate, start: proposal.newStart, end: proposal.newEnd, roomId: proposal.newRoomId, faculty: proposal.newFaculty }
    if (current.status !== 'cancelled' && sameSlotValues(current.effective, asValues)) return ret(state, fail('No changes to apply.'))
    const bad = checkProposal(state, lecture, proposal, today)
    if (bad) return ret(state, bad)
    const regular = { date, start: lecture.start, end: lecture.end, roomId: lecture.roomId, faculty: lecture.faculty }
    const onlyRoom = asValues.date === regular.date && asValues.start === regular.start && asValues.end === regular.end && asValues.faculty === regular.faculty
    kind = proposal.newFaculty !== lecture.faculty ? 'facultyChange' : onlyRoom ? 'roomChange' : 'reschedule'
  }

  const s = draft(state)
  // A teacher can only REQUEST a faculty change — it never applies directly.
  if (actor.role === 'teacher' && (kind === 'facultyChange' || teacherNeedsApproval(state.settings, kind))) {
    if (state.requests.some(r => r.status === 'pending' && r.lectureId === lecture.id && r.date === date)) {
      return ret(state, fail('A request for this lecture on this date is already waiting for approval.'))
    }
    const req = {
      id: nextId(s, 'rq'), type, kind, lectureId: lecture.id, date, proposal, reason,
      requestedBy: { name: actor.name, email: actor.email }, status: 'pending', createdAt: nowISO(), decision: null,
    }
    s.requests = [req, ...s.requests]
    const original = { date, start: lecture.start, end: lecture.end, roomId: lecture.roomId, faculty: lecture.faculty }
    const updated = type === 'change' ? { date: proposal.newDate, start: proposal.newStart, end: proposal.newEnd, roomId: proposal.newRoomId, faculty: proposal.newFaculty } : null
    const verb = { cancel: 'cancel', roomChange: 'change the room of', reschedule: 'reschedule', facultyChange: 'change the faculty of' }[kind]
    notify(s, {
      kind: 'request', category: 'requests', severity: 'info', title: `Approval needed: ${REQUEST_LABEL[kind]}`, subject: lecture.subject,
      body: `${actor.name} (${deptShort(actor.department || lecture.deptId)}) asked to ${verb} ${lecture.subject} (${classLabel(lecture)}) on ${formatDate(date)}.`
        + (updated ? ` Original: ${formatRange(original.start, original.end)}, ${original.roomId || 'no room listed'}. Requested: ${formatDate(updated.date)}, ${formatRange(updated.start, updated.end)}, ${updated.roomId}${kind === 'facultyChange' ? `, faculty ${updated.faculty}` : ''}.` : '')
        + ` Reason: ${reason}`,
      original: snapshot(original), updated: updated ? snapshot(updated) : null, changes: updated ? diffLecture(original, updated) : [{ field: 'Status', from: 'Scheduled', to: 'Cancelled' }],
      reason, audience: { management: true }, requestId: req.id, link: `/app/requests?focus=${req.id}`,
      details: { requestType: kind, teacher: actor.name, department: deptName(actor.department || lecture.deptId), submittedAt: req.createdAt, status: 'pending' },
    })
    audit(s, actor, 'request.create', `Requested ${type === 'cancel' ? 'cancellation' : 'change'} of ${lecture.subject} (${classLabel(lecture)}) on ${formatDate(date)}`, reason)
    return ret(s, { ok: true, pending: true, request: req, message: 'Request sent to the administrator for approval.' })
  }
  applyException(s, actor, { lecture, date, type, proposal, reason })
  return ret(s, { ok: true, applied: true, message: type === 'cancel' ? 'Lecture cancelled and students notified.' : 'Change published and students notified.' })
}

// Admin: remove an exception so the lecture goes back to its regular timetable.
export function restoreLecture(state, actor, { lectureId, date, reason }, ctx = {}) {
  if (!can(actor, 'timetable.edit')) return ret(state, fail('Only an administrator can restore a lecture.'))
  const lecture = state.lectures.find(l => l.id === lectureId)
  const ex = lecture && state.exceptions.find(e => e.lectureId === lectureId && e.originalDate === date)
  if (!ex) return ret(state, fail('There is no change to undo for this date.'))
  if (date < (ctx.today || todayISO())) return ret(state, fail('Past lectures cannot be changed.'))
  const entryBefore = entryFor(state, lecture, date)
  if (entryBefore.status === 'cancelled' || entryBefore.effective.date !== date) {
    const probe = { ...state, exceptions: state.exceptions.filter(e => e !== ex) }
    const conflicts = findConflicts(probe, { date, start: lecture.start, end: lecture.end, roomId: lecture.roomId, faculty: lecture.faculty, deptId: lecture.deptId, semester: lecture.semester, division: lecture.division, batch: lecture.batch || '', kind: lecture.kind || 'lecture' }, { source: 'lecture', id: lecture.id })
    if (conflicts.length) return ret(state, fail(`Cannot restore: ${conflictSummary(conflicts)}`, { conflicts }))
  }
  const s = draft(state)
  s.exceptions = s.exceptions.filter(e => e !== ex)
  const a = snapshot({ date, start: lecture.start, end: lecture.end, roomId: lecture.roomId, faculty: lecture.faculty })
  notify(s, {
    kind: 'restored', severity: 'info', title: 'Schedule Restored', subject: lecture.subject,
    body: `Your ${lecture.subject} lecture on ${a.dateLabel} is back to its regular schedule: ${a.time}, ${a.room} (${a.building}).`,
    original: null, updated: a, changes: [], reason: (reason || '').trim() || 'Regular schedule restored',
    audience: audienceForLecture(lecture, [ex.newFaculty]), lectureId, publishedBy: actor.name,
  })
  audit(s, actor, 'lecture.restore', `${lecture.subject} (${classLabel(lecture)}) on ${formatDate(date)} restored to regular schedule`, reason || '')
  return ret(s, { ok: true, message: 'Regular schedule restored.' })
}

export function decideRequest(state, actor, { requestId, decision, note = '' }, ctx = {}) {
  if (!can(actor, 'request.decide')) return ret(state, fail('Only an administrator can approve or reject requests.'))
  if (!['approve', 'reject'].includes(decision)) return ret(state, fail('Decision must be approve or reject.'))
  const req = state.requests.find(r => r.id === requestId)
  if (!req || req.status !== 'pending') return ret(state, fail('This request has already been decided.'))
  const lecture = state.lectures.find(l => l.id === req.lectureId)
  let s = draft(state)
  const decisionInfo = { by: actor.name, at: nowISO(), reason: note.trim() }

  if (decision === 'reject') {
    if (!note.trim()) return ret(state, fail('Please give a reason for rejecting this request.'))
  } else if (req.type === 'add') {
    // A teacher asked for a NEW weekly lecture: re-validate and create it through the admin path.
    const made = saveLecture(state, actor, { ...req.proposal, faculty: req.requestedBy.name }, ctx)
    if (!made.result.ok) return ret(state, fail(`This request can no longer be approved — ${made.result.message}`, { conflicts: made.result.conflicts, alternatives: made.result.alternatives }))
    s = draft(made.state)
  } else {
    if (!lecture) return ret(state, fail('The lecture for this request no longer exists.'))
    if (lecture.inactive) return ret(state, fail('This lecture is no longer part of an active timetable, so the request cannot be approved. You can still reject it.'))
    const today = ctx.today || todayISO()
    if (req.date < today) return ret(state, fail('This request is for a past date and can no longer be approved.'))
    // Re-check at approval time: the room may have been taken since the request was made.
    if (req.type === 'change') {
      const bad = checkProposal(state, lecture, req.proposal, today)
      if (bad) return ret(state, fail(`This request can no longer be approved — ${bad.message}`, { conflicts: bad.conflicts, alternatives: bad.alternatives }))
    } else if (entryFor(state, lecture, req.date).status === 'cancelled') {
      return ret(state, fail('This lecture is already cancelled.'))
    }
    applyException(s, actor, { lecture, date: req.date, type: req.type, proposal: req.proposal, reason: req.reason, requestedBy: req.requestedBy })
  }
  s.requests = s.requests.map(r => (r.id === requestId ? { ...r, status: decision === 'approve' ? 'approved' : 'rejected', decision: decisionInfo } : r))
  const subject = lecture?.subject || req.proposal?.subject || 'lecture'
  const when = req.date ? ` on ${formatDate(req.date)}` : ''
  notify(s, {
    kind: 'decision', category: 'requests', severity: decision === 'approve' ? 'info' : 'warning',
    title: decision === 'approve' ? 'Request approved' : 'Request rejected', subject,
    body: `Your request for ${subject}${when} was ${decision === 'approve' ? 'approved and published' : 'rejected'} by ${actor.name}.${note.trim() ? ` Note: ${note.trim()}` : ''}`,
    reason: note.trim(), audience: { faculty: { names: [req.requestedBy.name] } }, requestId: req.id, link: `/app/requests?focus=${req.id}`,
    details: { requestType: req.kind, status: decision === 'approve' ? 'approved' : 'rejected' },
  })
  audit(s, actor, decision === 'approve' ? 'request.approve' : 'request.reject', `${decision === 'approve' ? 'Approved' : 'Rejected'} ${req.requestedBy.name}'s request for ${subject}${when}`, note.trim())
  return ret(s, { ok: true, message: decision === 'approve' ? 'Approved — the change is published and everyone affected is notified.' : 'Request rejected.' })
}

// A teacher asks for a NEW weekly lecture. Nothing changes until an administrator approves.
export function requestNewLecture(state, actor, input, ctx = {}) {
  if (!can(actor, 'lecture.add.request')) return ret(state, fail('Only teachers can request a new lecture.'))
  if (actor.role !== 'teacher') return ret(state, fail('Administrators add lectures directly from Manage Timetables.'))
  const reason = (input.reason || '').trim()
  if (!isValidClass(input.deptId, input.semester, input.division)) return ret(state, fail('Please choose a valid department, semester and division.'))
  if (!(input.subject || '').trim()) return ret(state, fail('Please enter the subject.'))
  if (!WEEKDAYS.includes(input.weekday)) return ret(state, fail('Please choose a weekday (Monday–Friday).'))
  if (!input.start || !input.end || toMinutes(input.end) <= toMinutes(input.start)) return ret(state, fail('End time must be after start time.'))
  if (!roomById(input.roomId)) return ret(state, fail('Please choose a room.'))
  if (!reason) return ret(state, fail('Please enter a reason for this request.'))
  const proposal = { deptId: input.deptId, semester: input.semester, division: input.division, subject: input.subject.trim(), weekday: input.weekday, start: input.start, end: input.end, roomId: input.roomId }
  const cand = { ...proposal, faculty: actor.name }
  const conflicts = findRecurringConflicts(state, cand)
  if (conflicts.length) return ret(state, fail(conflictSummary(conflicts), { conflicts }))
  const same = r => r.type === 'add' && r.status === 'pending' && r.requestedBy.email === actor.email && ['deptId', 'semester', 'division', 'subject', 'weekday', 'start', 'end', 'roomId'].every(k => r.proposal[k] === proposal[k])
  if (state.requests.some(same)) return ret(state, fail('You already have an identical request waiting for approval.'))
  const s = draft(state)
  const req = { id: nextId(s, 'rq'), type: 'add', kind: 'add', lectureId: null, date: null, proposal, reason, requestedBy: { name: actor.name, email: actor.email }, status: 'pending', createdAt: nowISO(), decision: null }
  s.requests = [req, ...s.requests]
  notify(s, {
    kind: 'request', category: 'requests', severity: 'info', title: 'Approval needed: new lecture', subject: proposal.subject,
    body: `${actor.name} (${deptShort(actor.department || proposal.deptId)}) asked to add ${proposal.subject} for ${classLabel(proposal)}: ${proposal.weekday} ${formatRange(proposal.start, proposal.end)} in ${proposal.roomId}. Reason: ${reason}`,
    original: null, updated: snapshot({ date: ctx.today || todayISO(), start: proposal.start, end: proposal.end, roomId: proposal.roomId, faculty: actor.name }), changes: [],
    reason, audience: { management: true }, requestId: req.id, link: `/app/requests?focus=${req.id}`,
    details: { requestType: 'add', teacher: actor.name, department: deptName(actor.department || proposal.deptId), submittedAt: req.createdAt, status: 'pending' },
  })
  audit(s, actor, 'request.create', `Requested new lecture ${proposal.subject} for ${classLabel(proposal)} (${proposal.weekday} ${formatRange(proposal.start, proposal.end)})`, reason)
  return ret(s, { ok: true, pending: true, request: req, message: 'Request sent to the administrator for approval.' })
}

// ----------------------------------------------------------------------------
// ROOM BOOKINGS
// ----------------------------------------------------------------------------
function validateBookingFields(f) {
  if (!roomById(f.roomId)) return 'Please choose a room.'
  if (!f.date) return 'Please choose a date.'
  if (!f.start || !f.end || toMinutes(f.end) <= toMinutes(f.start)) return 'End time must be after start time.'
  if (!(f.purpose || '').trim()) return 'Please enter the purpose of the booking.'
  if (!(f.faculty || '').trim()) return 'Please enter the faculty name.'
  return null
}

export function createBooking(state, actor, input, ctx = {}) {
  if (!can(actor, 'booking.create')) return ret(state, fail('You do not have permission to book rooms.'))
  const f = { ...input, faculty: actor.role === 'teacher' ? actor.name : input.faculty }
  const problem = validateBookingFields(f)
  if (problem) return ret(state, fail(problem))
  if (f.date < (ctx.today || todayISO())) return ret(state, fail('Bookings cannot be made for a past date.'))
  const cand = { date: f.date, start: f.start, end: f.end, roomId: f.roomId, faculty: f.faculty }
  const conflicts = findConflicts(state, cand)
  if (conflicts.length) {
    return ret(state, fail(`Room unavailable — ${conflictSummary(conflicts)}`, { conflicts, alternatives: suggestAlternatives(state, cand) }))
  }
  const s = draft(state)
  const needsApproval = actor.role === 'teacher' && roomById(f.roomId).type === 'Seminar Hall' && state.settings.seminarHallBooking === 'approval'
  const booking = {
    id: nextId(s, 'bk'), roomId: f.roomId, date: f.date, start: f.start, end: f.end, purpose: f.purpose.trim(),
    faculty: f.faculty.trim(), deptId: f.deptId || actor.department || null, status: needsApproval ? 'pending' : 'approved',
    createdBy: { name: actor.name, email: actor.email }, createdAt: nowISO(), decision: null,
  }
  s.bookings = [booking, ...s.bookings]
  if (needsApproval) {
    notify(s, {
      kind: 'request', severity: 'info', title: 'Approval needed: seminar hall booking', subject: booking.purpose,
      body: `${actor.name} requested ${booking.roomId} on ${formatDate(booking.date)}, ${formatRange(booking.start, booking.end)} for "${booking.purpose}".`,
      audience: { management: true }, category: 'requests', link: `/app/requests?focus=${booking.id}`,
      details: { requestType: 'booking', teacher: actor.name, department: deptName(booking.deptId || actor.department), submittedAt: booking.createdAt, status: 'pending' },
    })
  }
  audit(s, actor, needsApproval ? 'booking.request' : 'booking.create', `${needsApproval ? 'Requested' : 'Booked'} ${booking.roomId} on ${formatDate(booking.date)}, ${formatRange(booking.start, booking.end)} — ${booking.purpose}`)
  return ret(s, { ok: true, booking, pending: needsApproval, message: needsApproval ? 'Request sent — seminar hall bookings need administrator approval.' : `Room booked — ${booking.roomId} is confirmed.` })
}

export function updateBooking(state, actor, input, ctx = {}) {
  const old = state.bookings.find(b => b.id === input.id)
  if (!old) return ret(state, fail('Booking not found.'))
  if (!can(actor, 'booking.manage', { booking: old })) return ret(state, fail('You can only edit your own bookings.'))
  if (old.status === 'cancelled' || old.status === 'rejected') return ret(state, fail('This booking can no longer be edited.'))
  const f = { ...old, ...input, faculty: actor.role === 'teacher' ? old.faculty : input.faculty ?? old.faculty }
  const problem = validateBookingFields(f)
  if (problem) return ret(state, fail(problem))
  if (f.date < (ctx.today || todayISO())) return ret(state, fail('Bookings cannot be moved to a past date.'))
  const cand = { date: f.date, start: f.start, end: f.end, roomId: f.roomId, faculty: f.faculty }
  const conflicts = findConflicts(state, cand, { source: 'booking', id: old.id })
  if (conflicts.length) return ret(state, fail(`Room unavailable — ${conflictSummary(conflicts)}`, { conflicts, alternatives: suggestAlternatives(state, cand, { source: 'booking', id: old.id }) }))
  const s = draft(state)
  const needsApproval = actor.role === 'teacher' && roomById(f.roomId).type === 'Seminar Hall' && state.settings.seminarHallBooking === 'approval'
  const updated = { ...old, roomId: f.roomId, date: f.date, start: f.start, end: f.end, purpose: f.purpose.trim(), faculty: f.faculty, status: needsApproval ? 'pending' : old.status }
  s.bookings = s.bookings.map(b => (b.id === old.id ? updated : b))
  audit(s, actor, 'booking.update', `Updated booking ${old.roomId} → ${updated.roomId} on ${formatDate(updated.date)}, ${formatRange(updated.start, updated.end)}`)
  return ret(s, { ok: true, booking: updated, message: 'Booking updated.' })
}

export function cancelBooking(state, actor, { id, reason }) {
  const b = state.bookings.find(x => x.id === id)
  if (!b) return ret(state, fail('Booking not found.'))
  if (!can(actor, 'booking.manage', { booking: b })) return ret(state, fail('You can only cancel your own bookings.'))
  if (b.status === 'cancelled') return ret(state, fail('This booking is already cancelled.'))
  if (!(reason || '').trim()) return ret(state, fail('Please enter a reason for cancelling.'))
  const s = draft(state)
  s.bookings = s.bookings.map(x => (x.id === id ? { ...x, status: 'cancelled', decision: { by: actor.name, at: nowISO(), reason: reason.trim() } } : x))
  if (b.createdBy?.email !== actor.email) {
    notify(s, {
      kind: 'decision', severity: 'warning', title: 'Booking cancelled', subject: b.purpose,
      body: `${actor.name} cancelled your booking of ${b.roomId} on ${formatDate(b.date)}, ${formatRange(b.start, b.end)}. Reason: ${reason.trim()}`,
      audience: { faculty: { names: [b.createdBy.name] } },
    })
  }
  audit(s, actor, 'booking.cancel', `Cancelled ${b.roomId} on ${formatDate(b.date)}, ${formatRange(b.start, b.end)} (${b.purpose})`, reason.trim())
  return ret(s, { ok: true, message: 'Booking cancelled — the room is free again.' })
}

export function decideBooking(state, actor, { id, decision, note = '' }, ctx = {}) {
  if (!can(actor, 'request.decide')) return ret(state, fail('Only an administrator can approve or reject bookings.'))
  const b = state.bookings.find(x => x.id === id)
  if (!b || b.status !== 'pending') return ret(state, fail('This booking is not waiting for approval.'))
  if (decision === 'reject' && !note.trim()) return ret(state, fail('Please give a reason for rejecting this booking.'))
  if (decision === 'approve') {
    if (b.date < (ctx.today || todayISO())) return ret(state, fail('This booking is for a past date.'))
    const conflicts = findConflicts(state, { date: b.date, start: b.start, end: b.end, roomId: b.roomId, faculty: b.faculty }, { source: 'booking', id: b.id })
    if (conflicts.length) return ret(state, fail(`Cannot approve — ${conflictSummary(conflicts)}`, { conflicts, alternatives: suggestAlternatives(state, b, { source: 'booking', id: b.id }) }))
  }
  const s = draft(state)
  const status = decision === 'approve' ? 'approved' : 'rejected'
  s.bookings = s.bookings.map(x => (x.id === id ? { ...x, status, decision: { by: actor.name, at: nowISO(), reason: note.trim() } } : x))
  notify(s, {
    kind: 'decision', severity: decision === 'approve' ? 'info' : 'warning', title: `Booking ${status}`, subject: b.purpose,
    body: `Your booking of ${b.roomId} on ${formatDate(b.date)}, ${formatRange(b.start, b.end)} was ${status} by ${actor.name}.${note.trim() ? ` Note: ${note.trim()}` : ''}`,
    audience: { faculty: { names: [b.createdBy.name] } },
  })
  audit(s, actor, `booking.${status}`, `${status === 'approved' ? 'Approved' : 'Rejected'} ${b.roomId} on ${formatDate(b.date)} for ${b.createdBy.name}`, note.trim())
  return ret(s, { ok: true, message: `Booking ${status}.` })
}

// ----------------------------------------------------------------------------
// SEMINARS & EVENTS (admin)
// ----------------------------------------------------------------------------
export function saveEvent(state, actor, input) {
  if (!can(actor, 'event.manage')) return ret(state, fail('Only an administrator can manage seminars and events.'))
  const old = input.id ? state.events.find(e => e.id === input.id) : null
  if (input.id && !old) return ret(state, fail('Event not found.'))
  if (!(input.title || '').trim()) return ret(state, fail('Please enter a title.'))
  if (!(input.committee || '').trim()) return ret(state, fail('Please enter the organizing committee.'))
  if (!input.date) return ret(state, fail('Please choose a date.'))
  if (!input.start || !input.end || toMinutes(input.end) <= toMinutes(input.start)) return ret(state, fail('End time must be after start time.'))
  const room = roomById(input.roomId)
  if (!room) return ret(state, fail('Please choose a venue.'))
  const seatsTotal = Number(input.seatsTotal) || room.capacity
  const ev = {
    kind: 'event', speaker: '', description: '', attendanceRequired: false, ...old, ...input,
    title: input.title.trim(), committee: input.committee.trim(), seatsTotal,
    seatsAvailable: old ? Math.min(old.seatsAvailable, seatsTotal) : seatsTotal,
    audience: input.audience || { deptId: 'all', semester: 'all' }, status: 'scheduled',
  }
  const conflicts = findEventConflicts(state, ev, old?.id)
  if (conflicts.length) {
    const alt = { date: ev.date, start: ev.start, end: ev.end, roomId: ev.roomId, minCapacity: Math.min(seatsTotal, room.capacity) }
    return ret(state, fail(`Scheduling conflict — resolve it before saving. ${conflictSummary(conflicts)}`, { conflicts, alternatives: suggestAlternatives(state, alt, { source: 'event', id: old?.id || '__draft__' }) }))
  }
  const s = draft(state)
  const label = eventKindLabel(ev.kind)
  if (old) {
    s.events = s.events.map(e => (e.id === old.id ? ev : e))
    const before = { date: old.date, start: old.start, end: old.end, roomId: old.roomId }
    const after = { date: ev.date, start: ev.start, end: ev.end, roomId: ev.roomId }
    const changes = diffLecture(before, after)
    if (changes.length && old.status === 'scheduled') {
      notify(s, {
        kind: 'seminar', severity: 'event', title: `${label} updated: ${ev.title}`, subject: ev.title,
        body: `${ev.title} has changed — ${describeChanges(changes)}.`, original: snapshot(before), updated: snapshot(after),
        changes, reason: '', audience: audienceForEvent(ev), publishedBy: actor.name,
      })
    }
    audit(s, actor, 'event.update', `Updated ${label.toLowerCase()} "${ev.title}"${changes.length ? ` — ${describeChanges(changes)}` : ''}`)
  } else {
    ev.id = nextId(s, 'ev')
    s.events = [ev, ...s.events]
    notify(s, {
      kind: 'seminar', severity: 'event', title: `New ${label}: ${ev.title}`, subject: ev.title,
      body: `${formatDate(ev.date)}, ${formatRange(ev.start, ev.end)} · ${roomLabel(ev.roomId)}. Organized by ${ev.committee}.`,
      original: null, updated: snapshot(ev), changes: [], reason: '', audience: audienceForEvent(ev), publishedBy: actor.name,
    })
    audit(s, actor, 'event.create', `Created ${label.toLowerCase()} "${ev.title}" on ${formatDate(ev.date)} in ${ev.roomId}`)
  }
  return ret(s, { ok: true, event: ev, message: old ? 'Event updated.' : 'Event created and announced.' })
}

// A TEACHER proposes a seminar. It is stored as status "proposed": it blocks nothing and nobody except the
// administrator (and the proposer) can see it until an administrator approves it.
function buildProposal(state, actor, input, ctx, old = null) {
  if (!(input.title || '').trim()) return { error: fail('Please enter a title.') }
  if (!input.date) return { error: fail('Please choose a date.') }
  if (input.date < (ctx.today || todayISO())) return { error: fail('A seminar cannot be proposed for a past date.') }
  if (!input.start || !input.end || toMinutes(input.end) <= toMinutes(input.start)) return { error: fail('End time must be after start time.') }
  const room = roomById(input.roomId)
  if (!room) return { error: fail('Please choose a venue.') }
  const aud = input.audience || { deptId: actor.department || 'all', semester: 'all' }
  const ev = {
    kind: 'seminar', speaker: (input.speaker || '').trim(), description: (input.description || '').trim(), attendanceRequired: false,
    ...old, id: old?.id, title: input.title.trim(), date: input.date, start: input.start, end: input.end, roomId: input.roomId,
    committee: (input.committee || '').trim() || `${deptName(actor.department)} Department`,
    seatsTotal: room.capacity, seatsAvailable: room.capacity, audience: { deptId: aud.deptId || 'all', semester: aud.semester || 'all' },
    status: 'proposed', proposedBy: { name: actor.name, email: actor.email },
  }
  const conflicts = findEventConflicts(state, ev, old?.id)
  if (conflicts.length) {
    const alt = { date: ev.date, start: ev.start, end: ev.end, roomId: ev.roomId, minCapacity: 0 }
    return { error: fail(`Scheduling conflict — ${conflictSummary(conflicts)}`, { conflicts, alternatives: suggestAlternatives(state, alt, { source: 'event', id: old?.id || '__draft__' }) }) }
  }
  return { ev }
}
const seminarSummary = ev => `"${ev.title}" on ${formatDate(ev.date)}, ${formatRange(ev.start, ev.end)} in ${ev.roomId} for ${ev.audience.deptId === 'all' ? 'all departments' : deptName(ev.audience.deptId)}${ev.audience.semester && ev.audience.semester !== 'all' ? ` ${ev.audience.semester}` : ''}`

export function proposeSeminar(state, actor, input, ctx = {}) {
  if (!can(actor, 'seminar.propose') || actor.role !== 'teacher') return ret(state, fail('Only teachers propose seminars; administrators create them directly.'))
  const built = buildProposal(state, actor, input, ctx)
  if (built.error) return ret(state, built.error)
  const dup = state.events.find(e => e.status === 'proposed' && e.proposedBy?.email === actor.email && e.title === built.ev.title && e.date === built.ev.date && e.start === built.ev.start && e.roomId === built.ev.roomId)
  if (dup) return ret(state, fail('You already proposed this seminar and it is waiting for approval.'))
  const s = draft(state)
  const ev = { ...built.ev, id: nextId(s, 'ev'), createdAt: nowISO() }
  s.events = [ev, ...s.events]
  notify(s, {
    kind: 'request', category: 'requests', severity: 'info', title: 'Approval needed: seminar proposal', subject: ev.title,
    body: `${actor.name} (${deptShort(actor.department)}) proposed a seminar: ${seminarSummary(ev)}.${ev.speaker ? ` Speaker: ${ev.speaker}.` : ''} Review the date, time, venue and affected classes before approving.`,
    original: null, updated: snapshot(ev), changes: [], reason: '', audience: { management: true }, eventId: ev.id, link: `/app/requests?focus=${ev.id}`,
    details: { requestType: 'seminar', teacher: actor.name, department: deptName(actor.department), submittedAt: ev.createdAt, status: 'pending' },
  })
  audit(s, actor, 'seminar.propose', `Proposed seminar ${seminarSummary(ev)}`)
  return ret(s, { ok: true, pending: true, event: ev, message: 'Seminar proposal sent to the administrator for approval.' })
}

// A teacher can change their OWN proposal while it is still waiting; the administrator is told again.
export function updateSeminarProposal(state, actor, input, ctx = {}) {
  const old = state.events.find(e => e.id === input.id)
  if (!old || old.status !== 'proposed') return ret(state, fail('Only a proposal that is still waiting for approval can be edited.'))
  if (actor.role !== 'teacher' || old.proposedBy?.email !== actor.email) return ret(state, fail('You can only edit your own seminar proposals.'))
  const built = buildProposal(state, actor, input, ctx, old)
  if (built.error) return ret(state, built.error)
  const s = draft(state)
  s.events = s.events.map(e => (e.id === old.id ? built.ev : e))
  notify(s, {
    kind: 'request', category: 'requests', severity: 'info', title: 'Seminar proposal updated', subject: built.ev.title,
    body: `${actor.name} changed their seminar proposal: ${seminarSummary(built.ev)}.`,
    original: snapshot(old), updated: snapshot(built.ev), changes: diffLecture(old, built.ev), reason: '', audience: { management: true }, eventId: old.id, link: `/app/requests?focus=${old.id}`,
    details: { requestType: 'seminar', teacher: actor.name, department: deptName(actor.department), status: 'pending' },
  })
  audit(s, actor, 'seminar.propose.update', `Updated seminar proposal ${seminarSummary(built.ev)}`)
  return ret(s, { ok: true, event: built.ev, message: 'Proposal updated and the administrator was notified.' })
}

export function decideSeminar(state, actor, { id, decision, note = '' }, ctx = {}) {
  if (!can(actor, 'request.decide')) return ret(state, fail('Only an administrator can approve or reject seminars.'))
  if (!['approve', 'reject'].includes(decision)) return ret(state, fail('Decision must be approve or reject.'))
  const ev = state.events.find(e => e.id === id)
  if (!ev || ev.status !== 'proposed') return ret(state, fail('This seminar proposal has already been decided.'))
  if (decision === 'reject' && !note.trim()) return ret(state, fail('Please give a reason for rejecting this proposal.'))
  const s = draft(state)
  if (decision === 'approve') {
    if (ev.date < (ctx.today || todayISO())) return ret(state, fail('This proposal is for a past date and can no longer be approved.'))
    const conflicts = findEventConflicts(state, ev, ev.id)
    if (conflicts.length) return ret(state, fail(`Cannot approve — ${conflictSummary(conflicts)}`, { conflicts, alternatives: suggestAlternatives(state, { date: ev.date, start: ev.start, end: ev.end, roomId: ev.roomId }, { source: 'event', id: ev.id }) }))
    const approved = { ...ev, status: 'scheduled', decision: { by: actor.name, at: nowISO(), reason: note.trim() } }
    s.events = s.events.map(e => (e.id === id ? approved : e))
    notify(s, {
      kind: 'seminar', severity: 'event', title: `New ${eventKindLabel(ev.kind)}: ${ev.title}`, subject: ev.title,
      body: `${formatDate(ev.date)}, ${formatRange(ev.start, ev.end)} · ${roomLabel(ev.roomId)}. Organized by ${ev.committee}.`,
      original: null, updated: snapshot(ev), changes: [], reason: '', audience: audienceForEvent(ev), publishedBy: actor.name,
    })
  } else {
    s.events = s.events.map(e => (e.id === id ? { ...ev, status: 'rejected', decision: { by: actor.name, at: nowISO(), reason: note.trim() } } : e))
  }
  notify(s, {
    kind: 'decision', category: 'requests', severity: decision === 'approve' ? 'info' : 'warning',
    title: decision === 'approve' ? 'Seminar proposal approved' : 'Seminar proposal rejected', subject: ev.title,
    body: `Your seminar proposal ${seminarSummary(ev)} was ${decision === 'approve' ? 'approved and announced' : 'rejected'} by ${actor.name}.${note.trim() ? ` Note: ${note.trim()}` : ''}`,
    reason: note.trim(), audience: { faculty: { names: [ev.proposedBy?.name] } }, eventId: ev.id, link: decision === 'approve' ? '/app/seminars' : `/app/requests?focus=${ev.id}`,
  })
  audit(s, actor, decision === 'approve' ? 'seminar.approve' : 'seminar.reject', `${decision === 'approve' ? 'Approved' : 'Rejected'} seminar proposal ${seminarSummary(ev)}`, note.trim())
  return ret(s, { ok: true, message: decision === 'approve' ? 'Approved — the seminar is announced to the affected classes.' : 'Proposal rejected.' })
}

export function cancelEvent(state, actor, { id, reason }) {
  if (!can(actor, 'event.manage')) return ret(state, fail('Only an administrator can cancel events.'))
  const ev = state.events.find(e => e.id === id)
  if (!ev || ev.status === 'cancelled') return ret(state, fail('Event not found or already cancelled.'))
  if (!(reason || '').trim()) return ret(state, fail('Please enter a reason for cancelling.'))
  const s = draft(state)
  s.events = s.events.map(e => (e.id === id ? { ...e, status: 'cancelled', cancelReason: reason.trim() } : e))
  notify(s, {
    kind: 'seminar', severity: 'urgent', title: `${eventKindLabel(ev.kind)} cancelled: ${ev.title}`, subject: ev.title,
    body: `${ev.title} on ${formatDate(ev.date)} (${roomLabel(ev.roomId)}) has been cancelled.`,
    original: snapshot(ev), updated: null, changes: [{ field: 'Status', from: 'Scheduled', to: 'Cancelled' }],
    reason: reason.trim(), audience: audienceForEvent(ev), publishedBy: actor.name,
  })
  audit(s, actor, 'event.cancel', `Cancelled "${ev.title}" on ${formatDate(ev.date)}`, reason.trim())
  return ret(s, { ok: true, message: 'Event cancelled — the venue is free again.' })
}

// ----------------------------------------------------------------------------
// RECURRING TIMETABLE (admin) — touches ONE lecture at a time, never a whole table
// ----------------------------------------------------------------------------
export function saveLecture(state, actor, input, ctx = {}) {
  if (!can(actor, 'timetable.edit')) return ret(state, fail('Only an administrator can edit the department timetable.'))
  const old = input.id ? state.lectures.find(l => l.id === input.id) : null
  if (input.id && !old) return ret(state, fail('Lecture not found.'))
  if (old?.source === 'official') return ret(state, fail(OFFICIAL_MSG))
  if (!(input.subject || '').trim()) return ret(state, fail('Please enter the subject.'))
  if (!(input.faculty || '').trim()) return ret(state, fail('Please choose the faculty member.'))
  if (!WEEKDAYS.includes(input.weekday)) return ret(state, fail('Please choose a weekday (Monday–Friday).'))
  if (!input.start || !input.end || toMinutes(input.end) <= toMinutes(input.start)) return ret(state, fail('End time must be after start time.'))
  const room = roomById(input.roomId)
  if (!room) return ret(state, fail('Please choose a room.'))
  if (old && !(input.reason || '').trim()) return ret(state, fail('Please enter a reason for changing the timetable.'))

  const cand = { weekday: input.weekday, start: input.start, end: input.end, roomId: input.roomId, faculty: input.faculty, deptId: input.deptId, semester: input.semester, division: input.division, batch: input.batch ?? old?.batch ?? '', kind: input.kind ?? old?.kind ?? 'lecture' }
  const conflicts = findRecurringConflicts(state, cand, old?.id)
  if (conflicts.length) {
    const roomsFree = rooms.filter(r => r.type === room.type && r.id !== room.id && !findRecurringConflicts(state, { ...cand, roomId: r.id }, old?.id).some(c => c.type === 'room')).slice(0, 4)
    return ret(state, fail(conflictSummary(conflicts), { conflicts, alternatives: { rooms: roomsFree, slots: [] } }))
  }
  const s = draft(state)
  const slot = timeSlots.find(t => t.start === input.start)
  const lec = {
    ...(old || {}), deptId: input.deptId, semester: input.semester, division: input.division,
    subject: input.subject.trim(), faculty: input.faculty, weekday: input.weekday,
    start: input.start, end: input.end, roomId: input.roomId, slotId: slot?.id || 0,
    updatedAt: nowISO(), updatedBy: actor.name,
  }
  const today = ctx.today || todayISO()
  if (!old) {
    lec.id = nextId(s, 'lec')
    s.lectures = [...s.lectures, lec]
    audit(s, actor, 'timetable.create', `Added ${lec.subject} to ${classLabel(lec)} — ${lec.weekday} ${formatRange(lec.start, lec.end)} in ${lec.roomId}`)
    notify(s, {
      kind: 'timetable_changed', severity: 'warning', title: 'Timetable Updated', subject: lec.subject,
      body: `A new regular lecture was added for ${classLabel(lec)}: ${lec.subject}, ${lec.weekday} ${formatRange(lec.start, lec.end)} in ${lec.roomId}.`,
      original: null, updated: snapshot({ date: today, start: lec.start, end: lec.end, roomId: lec.roomId, faculty: lec.faculty }), changes: [],
      reason: '', audience: audienceForLecture(lec), publishedBy: actor.name,
    })
    return ret(s, { ok: true, lecture: lec, message: 'Lecture added to the timetable.' })
  }
  s.lectures = s.lectures.map(l => (l.id === old.id ? lec : l))
  const changes = diffLecture({ date: today, start: old.start, end: old.end, roomId: old.roomId, faculty: old.faculty }, { date: today, start: lec.start, end: lec.end, roomId: lec.roomId, faculty: lec.faculty })
  if (old.weekday !== lec.weekday) {
    changes.unshift({ field: 'Day', from: old.weekday, to: lec.weekday })
    // Date-specific changes tied to the old weekday no longer make sense.
    s.exceptions = s.exceptions.filter(e => !(e.lectureId === old.id && e.originalDate >= today))
  }
  if (old.subject !== lec.subject) changes.unshift({ field: 'Subject', from: old.subject, to: lec.subject })
  if (!changes.length) return ret(state, fail('No changes to apply.'))
  audit(s, actor, 'timetable.update', `${lec.subject} (${classLabel(lec)}) — ${describeChanges(changes)}`, input.reason.trim())
  notify(s, {
    kind: 'timetable_changed', severity: 'warning', title: 'Timetable Updated', subject: lec.subject,
    body: `The regular ${lec.subject} lecture for ${classLabel(lec)} was updated — ${describeChanges(changes)}.`,
    original: snapshot({ date: today, start: old.start, end: old.end, roomId: old.roomId, faculty: old.faculty }),
    updated: snapshot({ date: today, start: lec.start, end: lec.end, roomId: lec.roomId, faculty: lec.faculty }),
    changes, reason: input.reason.trim(), audience: audienceForLecture(lec, [old.faculty]), publishedBy: actor.name,
  })
  return ret(s, { ok: true, lecture: lec, message: 'Timetable updated and published.' })
}

export function deleteLecture(state, actor, { id, reason }) {
  if (!can(actor, 'timetable.edit')) return ret(state, fail('Only an administrator can edit the department timetable.'))
  const lec = state.lectures.find(l => l.id === id)
  if (!lec) return ret(state, fail('Lecture not found.'))
  if (lec.source === 'official') return ret(state, fail(OFFICIAL_MSG))
  if (!(reason || '').trim()) return ret(state, fail('Please enter a reason for removing this lecture.'))
  const s = draft(state)
  s.lectures = s.lectures.filter(l => l.id !== id)
  s.exceptions = s.exceptions.filter(e => e.lectureId !== id)
  notify(s, {
    kind: 'timetable_changed', severity: 'urgent', title: 'Lecture Removed from Timetable', subject: lec.subject,
    body: `${lec.subject} (${lec.weekday}, ${formatRange(lec.start, lec.end)}) has been removed from the ${classLabel(lec)} timetable.`,
    original: null, updated: null, changes: [], reason: reason.trim(), audience: audienceForLecture(lec), publishedBy: actor.name,
  })
  audit(s, actor, 'timetable.delete', `Removed ${lec.subject} from ${classLabel(lec)} (${lec.weekday} ${formatRange(lec.start, lec.end)})`, reason.trim())
  return ret(s, { ok: true, message: 'Lecture removed from the timetable.' })
}

// Cancel every lecture of ONE department (optionally one semester) on ONE date.
// Other departments are never touched.
export function bulkCancelDay(state, actor, { deptId, semester = 'all', date, reason }, ctx = {}) {
  if (!can(actor, 'timetable.edit')) return ret(state, fail('Only an administrator can cancel a whole day.'))
  if (!deptId) return ret(state, fail('Choose a department.'))
  if (!(reason || '').trim()) return ret(state, fail('Please enter a reason.'))
  if (!isWorkingDay(date)) return ret(state, fail('Choose a working day (Monday–Friday).'))
  if (date < (ctx.today || todayISO())) return ret(state, fail('Past dates cannot be changed.'))
  const s = draft(state)
  const targets = getDaySchedule(state, date).filter(e =>
    !e.movedIn && e.status !== 'cancelled' && (deptId === 'all' || e.lecture.deptId === deptId) && (semester === 'all' || e.lecture.semester === semester))
  if (!targets.length) return ret(state, fail('There are no active lectures for that department on this date.'))
  for (const e of targets) applyException(s, actor, { lecture: e.lecture, date, type: 'cancel', proposal: {}, reason: reason.trim(), quiet: true })
  audit(s, actor, 'timetable.bulk_cancel', `Cancelled ${targets.length} ${deptName(deptId)} lecture(s) on ${formatDate(date)}`, reason.trim())
  return ret(s, { ok: true, count: targets.length, message: deptId === 'all'
    ? `${targets.length} lecture(s) cancelled across all departments on ${formatDate(date)}.`
    : `${targets.length} lecture(s) cancelled for ${deptName(deptId)}. Other departments are unchanged.` })
}

export function publishTimetable(state, actor, { deptId = 'all', semester = 'all', division = 'all' }) {
  if (!can(actor, 'timetable.edit')) return ret(state, fail('Only an administrator can publish timetables.'))
  const classes = [...new Map(state.lectures.filter(l =>
    (deptId === 'all' || l.deptId === deptId) &&
    (semester === 'all' || l.semester === semester) &&
    (division === 'all' || l.division === division))
    .map(l => [`${l.deptId}|${l.semester}|${l.division}`, { deptId: l.deptId, semester: l.semester, division: l.division }])).values()]
  if (!classes.length) return ret(state, fail('There is no timetable for that selection.'))
  const s = draft(state)
  const subject = deptId === 'all' ? 'all departments' : deptName(deptId)
  const body = deptId === 'all'
    ? 'The complete timetable for all departments and divisions has been published. Open the Timetable page to review it.'
    : `The ${deptName(deptId)}${semester === 'all' ? '' : ` ${semester}`} timetable has been published. Open the Timetable page to review it.`
  notify(s, {
    kind: 'published', severity: 'info', title: 'Updated Timetable Published', subject,
    body,
    original: null, updated: null, changes: [], reason: '',
    audience: {
      students: { groups: classes },
      faculty: { deptIds: deptId === 'all' ? departments.map(d => d.id) : [deptId] },
    }, publishedBy: actor.name,
  })
  audit(s, actor, 'timetable.publish', `Published ${subject}${semester === 'all' ? '' : ` ${semester}`} timetable`)
  return ret(s, { ok: true, message: 'Timetable published to students and faculty.' })
}

export function setSettings(state, actor, patch) {
  if (!can(actor, 'settings.edit')) return ret(state, fail('Only an administrator can change approval rules.'))
  const s = draft(state)
  s.settings = { ...state.settings, ...patch, teacherRules: { ...state.settings.teacherRules, ...(patch.teacherRules || {}) } }
  audit(s, actor, 'settings.update', 'Updated approval rules for teachers')
  return ret(s, { ok: true, message: 'Approval rules saved.' })
}

// Per-user read tracking (no permission needed — a user only touches their own list).
export function markRead(state, user, ids) {
  if (!user) return ret(state, fail('Not logged in.'))
  const prev = state.reads[user.email] || []
  const merged = [...new Set([...prev, ...ids])]
  if (merged.length === prev.length) return ret(state, { ok: true })
  return ret({ ...state, reads: { ...state.reads, [user.email]: merged } }, { ok: true })
}

export { rangesOverlap }
