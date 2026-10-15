// ============================================================================
// SCHEDULING ENGINE — the single source of truth for "who is where, when".
//
// Data model (all kept in one shared state object, see store/):
//   lectures    recurring weekly slots (weekday + start/end + room + faculty)
//   exceptions  date-specific changes to ONE occurrence of a lecture
//               (type "change" = new date/time/room/faculty, type "cancel")
//   bookings    ad-hoc room bookings (extra classes, meetings...)
//   events      seminars / workshops / college events held in a room
//
// getOccupancies(state, date) merges all four into one list of "blocks"
// (room + time range). EVERY feature — teacher booking, admin timetable edit,
// seminar creation, room availability page — asks findConflicts() the same
// question, so the rules can never drift apart.
// ============================================================================
import { rooms } from '../data/rooms.js'
import { timeSlots } from '../data/timetable.js'
import { addDays, formatRange, nextWorkingDay, toHHMM, toMinutes, weekdayOf } from './dates.js'
import { classLabel, roomById } from './lookup.js'

// Half-open interval overlap: 10:00–11:00 and 11:00–12:00 do NOT overlap
// (back-to-back bookings are allowed), 10:00–11:00 and 10:30–11:30 do.
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd)
}

export const exceptionFor = (state, lectureId, date) =>
  state.exceptions.find(e => e.lectureId === lectureId && e.originalDate === date)

// One occurrence of a lecture on a date, with any exception applied.
function buildEntry(lecture, ex, date) {
  const original = { date, start: lecture.start, end: lecture.end, roomId: lecture.roomId, faculty: lecture.faculty }
  let effective = { ...original }
  let status = 'scheduled'
  if (ex?.type === 'cancel') status = 'cancelled'
  if (ex?.type === 'change') {
    status = 'rescheduled'
    effective = {
      date: ex.newDate || date,
      start: ex.newStart || lecture.start,
      end: ex.newEnd || lecture.end,
      roomId: ex.newRoomId || lecture.roomId,
      faculty: ex.newFaculty || lecture.faculty,
    }
  }
  return {
    key: `${lecture.id}@${date}`, lecture, originalDate: date, viewDate: date,
    original, effective, status, exception: ex || null,
    movedOut: status === 'rescheduled' && effective.date !== date,
    movedIn: false,
  }
}
export const entryOccupies = entry => entry.status !== 'cancelled' && entry.effective.date === entry.viewDate

// All lecture occurrences visible on `date`: the regular ones for that weekday
// (cancelled / moved ones are flagged, not hidden) plus lectures moved INTO it.
export function getDaySchedule(state, date) {
  const weekday = weekdayOf(date)
  const entries = []
  for (const lec of state.lectures) {
    if (lec.inactive) continue
    if ((lec.validFrom && date < lec.validFrom) || (lec.validUntil && date > lec.validUntil)) continue
    if (lec.weekday === weekday) entries.push(buildEntry(lec, exceptionFor(state, lec.id, date), date))
  }
  for (const ex of state.exceptions) {
    if (ex.type === 'change' && ex.newDate === date && ex.originalDate !== date) {
      const lec = state.lectures.find(l => l.id === ex.lectureId)
      if (lec && !lec.inactive && !(lec.validFrom && ex.originalDate < lec.validFrom) && !(lec.validUntil && ex.originalDate > lec.validUntil)) entries.push({ ...buildEntry(lec, ex, ex.originalDate), viewDate: date, movedIn: true })
    }
  }
  return entries
}

const lectureBlock = (lec, label, extra = {}) => ({
  source: 'lecture', id: lec.id, roomId: lec.roomId, start: lec.start, end: lec.end,
  label, faculty: lec.faculty, deptId: lec.deptId, semester: lec.semester, division: lec.division,
  batch: lec.batch || '', kind: lec.kind || 'lecture', ...extra,
})

// Two sessions of the SAME class only clash if they would really put the same students in two places:
// parallel lab batches (different batch codes) and parallel electives are legitimate.
export function sameClassClash(a, b) {
  if (!(a.deptId && a.deptId === b.deptId && a.semester === b.semester && a.division === b.division)) return false
  if (a.batch && b.batch && a.batch !== b.batch) return false
  if (a.kind === 'elective' && b.kind === 'elective') return false
  return true
}

// Every occupied (room, time range) on a date, from all sources.
// `extraBlocks` lets callers test "what if this extra thing existed?" without saving it.
export function getOccupancies(state, date, extraBlocks = []) {
  const blocks = []
  for (const e of getDaySchedule(state, date)) {
    if (!entryOccupies(e)) continue
    blocks.push(lectureBlock(
      { ...e.lecture, roomId: e.effective.roomId, start: e.effective.start, end: e.effective.end, faculty: e.effective.faculty },
      `${e.lecture.subject} — ${classLabel(e.lecture)}`, { entry: e },
    ))
  }
  for (const b of state.bookings) {
    if (b.date === date && b.status === 'approved') {
      blocks.push({ source: 'booking', id: b.id, roomId: b.roomId, start: b.start, end: b.end, label: b.purpose, faculty: b.faculty, deptId: b.deptId, booking: b })
    }
  }
  for (const ev of state.events) {
    if (ev.date === date && ev.status === 'scheduled') {
      blocks.push({ source: 'event', id: ev.id, roomId: ev.roomId, start: ev.start, end: ev.end, label: ev.title, audience: ev.audience, attendanceRequired: ev.attendanceRequired, event: ev })
    }
  }
  for (const x of extraBlocks) if (x.date === date) blocks.push(x)
  return blocks
}

export function audienceMatches(audience, target) {
  if (!audience) return false
  const deptOk = !audience.deptId || audience.deptId === 'all' || audience.deptId === target.deptId
  const semOk = !audience.semester || audience.semester === 'all' || audience.semester === target.semester
  return deptOk && semOk
}

// Does a candidate (lecture / booking) clash with anything on its date?
//   room      same room, overlapping time
//   faculty   same teacher, overlapping time (a teacher can't be in two rooms)
//   division  same class group already has a lecture then
//   audience  a compulsory event for that class is on at that time
// `ignore` = {source,id} of the thing being edited, so it doesn't clash with itself.
export function findConflicts(state, cand, ignore = null, extraBlocks = []) {
  const out = []
  for (const b of getOccupancies(state, cand.date, extraBlocks)) {
    if (ignore && ignore.source === b.source && ignore.id === b.id) continue
    if (!rangesOverlap(cand.start, cand.end, b.start, b.end)) continue
    if (cand.roomId && b.roomId === cand.roomId) out.push({ type: 'room', block: b })
    if (cand.faculty && b.faculty && b.faculty === cand.faculty && b.source !== 'event') out.push({ type: 'faculty', block: b })
    if (cand.deptId && cand.division !== undefined && cand.division !== null && b.source === 'lecture' && sameClassClash(cand, b)) {
      out.push({ type: 'division', block: b })
    }
    if (cand.deptId && b.source === 'event' && b.attendanceRequired && audienceMatches(b.audience, cand)) out.push({ type: 'audience', block: b })
  }
  return out
}

// Same idea for the RECURRING weekly timetable (admin edits a weekly slot).
export function findRecurringConflicts(state, cand, ignoreLectureId = null) {
  const out = []
  for (const lec of state.lectures) {
    if (lec.inactive || lec.id === ignoreLectureId || lec.weekday !== cand.weekday) continue
    if (!rangesOverlap(cand.start, cand.end, lec.start, lec.end)) continue
    const block = lectureBlock(lec, `${lec.subject} — ${classLabel(lec)}`)
    if (cand.roomId && lec.roomId === cand.roomId) out.push({ type: 'room', block })
    if (cand.faculty && lec.faculty === cand.faculty) out.push({ type: 'faculty', block })
    if (sameClassClash({ ...cand, kind: cand.kind || 'lecture' }, block)) out.push({ type: 'division', block })
  }
  return out
}

// Conflicts for a seminar / event being created or edited.
export function findEventConflicts(state, ev, ignoreEventId = null) {
  const out = []
  for (const b of getOccupancies(state, ev.date)) {
    if (b.source === 'event' && b.id === ignoreEventId) continue
    if (!rangesOverlap(ev.start, ev.end, b.start, b.end)) continue
    if (b.roomId === ev.roomId) out.push({ type: 'room', block: b })
    // A lecture in a DIFFERENT room only matters if attendance is compulsory for that class.
    if (ev.attendanceRequired && b.source === 'lecture' && audienceMatches(ev.audience, b)) out.push({ type: 'audience', block: b })
  }
  return out
}

export const conflictLabels = {
  room: 'Room already in use',
  faculty: 'Faculty already teaching elsewhere',
  division: 'Class already has a lecture',
  audience: 'Compulsory event for this class',
}

// Alternatives: free rooms of the same type, and nearby free time windows.
export function suggestAlternatives(state, cand, ignore = null, extraBlocks = [], { maxRooms = 4, maxSlots = 4 } = {}) {
  const base = roomById(cand.roomId)
  const duration = toMinutes(cand.end) - toMinutes(cand.start)
  const sameType = rooms
    .filter(r => r.id !== cand.roomId && (!base || r.type === base.type) && r.capacity >= (cand.minCapacity || 0))
    .sort((a, b) => Number(b.building === base?.building) - Number(a.building === base?.building))
  const roomFree = (r, c) => !findConflicts(state, { ...c, roomId: r.id }, ignore, extraBlocks).some(x => x.type === 'room')
  const freeRooms = sameType.filter(r => roomFree(r, cand)).slice(0, maxRooms)

  const starts = [...new Set([...timeSlots.map(s => s.start), '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'])].sort()
  const slots = []
  const seenDates = new Set()
  for (let off = 0; off < 4 && slots.length < maxSlots; off++) {
    const date = nextWorkingDay(addDays(cand.date, off))
    if (seenDates.has(date)) continue
    seenDates.add(date)
    for (const start of starts) {
      const end = toHHMM(toMinutes(start) + duration)
      if (toMinutes(end) > 18 * 60 || (date === cand.date && start === cand.start)) continue
      const c = { ...cand, date, start, end }
      if (findConflicts(state, c, ignore, extraBlocks).length === 0) slots.push({ date, start, end, roomId: cand.roomId })
      else {
        const alt = sameType.find(r => !findConflicts(state, { ...c, roomId: r.id }, ignore, extraBlocks).length)
        if (alt) slots.push({ date, start, end, roomId: alt.id })
      }
      if (slots.length >= maxSlots) break
    }
  }
  return { rooms: freeRooms, slots }
}

// A one-click fix for a lecture that a new event pushes out of its room/time.
export function suggestMoveForEntry(state, entry, conflictType, event) {
  const eff = entry.effective
  const extra = event ? [{ date: event.date, source: 'event', id: '__draft__', roomId: event.roomId, start: event.start, end: event.end, audience: event.audience, attendanceRequired: event.attendanceRequired }] : []
  const cand = { date: eff.date, start: eff.start, end: eff.end, roomId: eff.roomId, faculty: eff.faculty, deptId: entry.lecture.deptId, semester: entry.lecture.semester, division: entry.lecture.division }
  const ignore = { source: 'lecture', id: entry.lecture.id }
  const alts = suggestAlternatives(state, cand, ignore, extra)
  if (conflictType === 'room' && alts.rooms[0]) {
    return { newDate: eff.date, newStart: eff.start, newEnd: eff.end, newRoomId: alts.rooms[0].id, label: `Move to ${alts.rooms[0].id} (same time)` }
  }
  const slot = alts.slots[0]
  if (slot) return { newDate: slot.date, newStart: slot.start, newEnd: slot.end, newRoomId: slot.roomId, label: `Move to ${slot.date} ${slot.start}–${slot.end} in ${slot.roomId}` }
  return null
}

export function conflictSummary(conflicts) {
  const kinds = [...new Set(conflicts.map(c => c.type))]
  return `Scheduling conflict — ${kinds.map(k => conflictLabels[k].toLowerCase()).join(', ')}.`
}

// Convenience: one occurrence of a specific lecture on a specific date.
export const entryFor = (state, lecture, date) => buildEntry(lecture, exceptionFor(state, lecture.id, date), date)

export const sameSlotValues = (a, b) =>
  a.date === b.date && a.start === b.start && a.end === b.end && a.roomId === b.roomId && a.faculty === b.faculty

// { 'YYYY-MM-DD': [entries] } for several dates, filtered and sorted by effective start time.
export function entriesByDate(state, dates, pred = () => true) {
  const out = {}
  for (const d of dates) {
    out[d] = getDaySchedule(state, d).filter(pred).sort((a, b) => a.effective.start.localeCompare(b.effective.start))
  }
  return out
}

// Status of every room for a date + time window: Occupied / Reserved (busy later that day) / Available.
export function roomStatuses(state, date, start, end) {
  const blocks = getOccupancies(state, date)
  const out = {}
  for (const r of rooms) {
    const mine = blocks.filter(b => b.roomId === r.id).sort((a, b) => a.start.localeCompare(b.start))
    const hit = mine.find(b => rangesOverlap(start, end, b.start, b.end))
    const later = mine.find(b => toMinutes(b.start) >= toMinutes(end))
    if (hit) out[r.id] = { status: 'Occupied', occupant: `${hit.label} (${formatRange(hit.start, hit.end)})` }
    else if (later) out[r.id] = { status: 'Reserved', occupant: `${later.label} (${formatRange(later.start, later.end)})` }
    else out[r.id] = { status: 'Available', occupant: null }
  }
  return out
}
