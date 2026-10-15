// Change detection: compare the ORIGINAL schedule of a lecture with its
// UPDATED schedule, field by field, and describe what changed in plain words.
//   if (original.room !== updated.room) -> "Room Changed"
import { formatDate, formatRange } from './dates.js'
import { roomById } from './lookup.js'

export function snapshot(v) {
  const r = roomById(v.roomId)
  return {
    date: v.date, dateLabel: formatDate(v.date), time: formatRange(v.start, v.end),
    room: v.roomId, building: r?.building || '', floor: r?.floor || '', faculty: v.faculty,
  }
}

// -> [{ field, from, to }] for every field that differs
export function diffLecture(original, updated) {
  const a = snapshot(original)
  const b = snapshot(updated)
  const changes = []
  if (a.date !== b.date) changes.push({ field: 'Date', from: a.dateLabel, to: b.dateLabel })
  if (a.time !== b.time) changes.push({ field: 'Time', from: a.time, to: b.time })
  if (a.room !== b.room) changes.push({ field: 'Room', from: a.room, to: b.room })
  if (a.building !== b.building) changes.push({ field: 'Building', from: a.building, to: b.building })
  if (a.floor !== b.floor) changes.push({ field: 'Floor', from: a.floor, to: b.floor })
  if (a.faculty !== b.faculty) changes.push({ field: 'Faculty', from: a.faculty, to: b.faculty })
  return changes
}

// Turns a diff into the notification the student/teacher sees.
export function describeLectureChange({ subject, original, updated, cancelled, reason }) {
  const a = snapshot(original)
  if (cancelled) {
    return {
      kind: 'cancelled', severity: 'urgent', title: 'Class Cancelled', subject,
      body: `Your ${subject} lecture on ${a.dateLabel}, ${a.time} (${a.room}, ${a.building}) has been cancelled.`,
      original: a, updated: null, changes: [{ field: 'Status', from: 'Scheduled', to: 'Cancelled' }], reason,
    }
  }
  const changes = diffLecture(original, updated)
  const has = f => changes.some(c => c.field === f)
  let kind = 'faculty_changed'; let title = 'Faculty Changed'; let severity = 'info'
  if (has('Date') || has('Time')) { kind = 'rescheduled'; title = 'Lecture Rescheduled'; severity = 'warning' }
  else if (has('Building')) { kind = 'building_changed'; title = 'Building Changed'; severity = 'warning' }
  else if (has('Room') || has('Floor')) { kind = 'room_changed'; title = 'Room Changed'; severity = 'warning' }
  const b = snapshot(updated)
  return {
    kind, severity, title, subject,
    body: `Your ${subject} lecture originally on ${a.dateLabel}, ${a.time} in ${a.room} (${a.building}) is now on ${b.dateLabel}, ${b.time} in ${b.room} (${b.building}).`,
    original: a, updated: b, changes, reason,
  }
}
