import { describe, it, expect } from 'vitest'
import { TODAY, ctx, seed, admin, kulkarni, shah, studentComp, studentIt, nextOwnLecture, freeRoomFor } from './helpers'
import * as ops from '../store/operations'
import { entryFor, findConflicts, getDaySchedule, getOccupancies } from '../utils/schedule'
import { commit, loadState, saveState } from '../store/persistence'
import { isRecipient } from '../utils/notifications'
import { rooms } from '../data/rooms'
import { addDays } from '../utils/dates'

const memoryStorage = () => {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}

describe('1. teacher changes a lecture room', () => {
  it('is applied directly (default rule), only for that date, and students are notified', () => {
    const s0 = seed()
    const { entry, date } = nextOwnLecture(s0, kulkarni.name)
    const room = freeRoomFor(s0, entry, date)
    const { state, result } = ops.submitLectureChange(s0, kulkarni, { type: 'change', lectureId: entry.lecture.id, date, newRoomId: room.id, reason: 'Projector broken' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.applied).toBe(true)
    expect(entryFor(state, entry.lecture, date).effective.roomId).toBe(room.id)
    // the same lecture the following week keeps its regular room
    expect(entryFor(state, entry.lecture, addDays(date, 7)).effective.roomId).toBe(entry.lecture.roomId)
    const n = state.notifications[0]
    expect(n.title).toMatch(/Room Changed|Building Changed/)
    expect(n.original.room).toBe(entry.lecture.roomId)
    expect(n.updated.room).toBe(room.id)
    expect(n.reason).toBe('Projector broken')
  })
})

describe('2. teacher reschedules to an available time', () => {
  it('needs approval by default; applies directly once the admin allows it', () => {
    const s0 = seed()
    const { entry, date } = nextOwnLecture(s0, shah.name)
    const l = entry.lecture
    const input = { type: 'change', lectureId: l.id, date, newStart: '15:00', newEnd: '16:00', newRoomId: l.roomId, reason: 'Department meeting' }
    const a = ops.submitLectureChange(s0, shah, input, ctx)
    expect(a.result.pending).toBe(true)
    expect(a.state.exceptions.length).toBe(s0.exceptions.length) // nothing published yet
    const s1 = ops.setSettings(s0, admin, { teacherRules: { reschedule: 'direct' } }).state
    const b = ops.submitLectureChange(s1, shah, input, ctx)
    expect(b.result.applied).toBe(true)
    expect(entryFor(b.state, l, date).effective.start).toBe('15:00')
  })
})

describe('3. teacher books an occupied room', () => {
  it('is rejected with a conflict and alternatives', () => {
    const s = seed()
    const date = addDays(TODAY, 1)
    const blk = getOccupancies(s, date).find(b => b.source === 'lecture')
    const { result, state } = ops.createBooking(s, kulkarni, { roomId: blk.roomId, date, start: blk.start, end: blk.end, purpose: 'Extra class' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.conflicts.some(c => c.type === 'room')).toBe(true)
    expect(result.alternatives.rooms.length).toBeGreaterThan(0)
    expect(state.bookings.length).toBe(s.bookings.length)
  })
  it('10:30–11:30 overlapping an existing 10:00–11:00 booking is rejected; 11:00–12:00 is accepted', () => {
    let s = seed()
    const date = addDays(TODAY, 3)
    s = ops.createBooking(s, kulkarni, { roomId: 'C-306', date, start: '16:00', end: '17:00', purpose: 'A' }, ctx).state
    expect(ops.createBooking(s, kulkarni, { roomId: 'C-306', date, start: '16:30', end: '17:30', purpose: 'B' }, ctx).result.ok).toBe(false)
    expect(ops.createBooking(s, kulkarni, { roomId: 'C-306', date, start: '17:00', end: '17:45', purpose: 'C' }, ctx).result.ok).toBe(true)
  })
})

describe('4. cancelling a lecture needs a reason', () => {
  it('fails without a reason, then follows the approval rule', () => {
    const s0 = seed()
    const { entry, date } = nextOwnLecture(s0, kulkarni.name)
    expect(ops.submitLectureChange(s0, kulkarni, { type: 'cancel', lectureId: entry.lecture.id, date, reason: '  ' }, ctx).result.ok).toBe(false)
    const asked = ops.submitLectureChange(s0, kulkarni, { type: 'cancel', lectureId: entry.lecture.id, date, reason: 'Conference' }, ctx)
    expect(asked.result.pending).toBe(true)
    const s1 = ops.setSettings(s0, admin, { teacherRules: { cancel: 'direct' } }).state
    const done = ops.submitLectureChange(s1, kulkarni, { type: 'cancel', lectureId: entry.lecture.id, date, reason: 'Conference' }, ctx)
    expect(done.result.applied).toBe(true)
    expect(entryFor(done.state, entry.lecture, date).status).toBe('cancelled')
  })
})

describe('5/6. admin edits one department without touching another', () => {
  it('edits a COMP lecture; all other departments lectures are byte-for-byte unchanged', () => {
    const s0 = seed()
    const comp = s0.lectures.find(l => l.deptId === 'comp' && l.semester === 'SEM III' && l.division === 'C1')
    const freeRoom = rooms.map(r => r.id).find(roomId => !s0.lectures.some(l => l.weekday === comp.weekday && l.start === comp.start && l.roomId === roomId))
    const { state, result } = ops.saveLecture(s0, admin, { ...comp, roomId: freeRoom, reason: 'Renovation' }, ctx)
    expect(result.ok).toBe(true)
    const others = l => l.deptId !== 'comp' || l.id !== comp.id
    expect(state.lectures.filter(others)).toEqual(s0.lectures.filter(others))
    expect(state.lectures.find(l => l.id === comp.id).roomId).toBe(freeRoom)
    expect(state.audit[0].reason).toBe('Renovation')
  })
  it('bulk-cancelling EXTC for a day leaves CHEM (and every other dept) untouched', () => {
    const s0 = seed()
    const date = addDays(TODAY, 2)
    const { state, result } = ops.bulkCancelDay(s0, admin, { deptId: 'extc', semester: 'all', date, reason: 'Exam day' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.count).toBeGreaterThan(0)
    const touched = new Set(state.exceptions.filter(e => !s0.exceptions.includes(e)).map(e => state.lectures.find(l => l.id === e.lectureId).deptId))
    expect([...touched]).toEqual(['extc'])
    expect(getDaySchedule(state, date).filter(e => e.lecture.deptId === 'chem').every(e => e.status === 'scheduled')).toBe(true)
  })
  it('teachers cannot edit the department timetable', () => {
    const s0 = seed()
    const { result } = ops.saveLecture(s0, kulkarni, { ...s0.lectures[0], reason: 'x' }, ctx)
    expect(result.ok).toBe(false)
  })
})

describe('7/8. seminar in an occupied hall', () => {
  it('is blocked, names the clashing booking, and suggests alternatives', () => {
    const s = seed()
    const bk = s.bookings.find(b => b.id === 'bk3')
    const { result, state } = ops.saveEvent(s, admin, { kind: 'seminar', title: 'AI and Future Technology Seminar', committee: 'CSI', date: bk.date, start: '11:00', end: '13:00', roomId: 'Seminar Hall 2', seatsTotal: 100 })
    expect(result.ok).toBe(false)
    expect(result.conflicts[0].block.source).toBe('booking')
    expect(result.alternatives.rooms.length).toBeGreaterThan(0)
    expect(state.events.length).toBe(s.events.length)
    expect(state.bookings.find(b => b.id === 'bk3').status).toBe('approved') // nothing cancelled automatically
  })
  it('can be saved once the admin has explicitly cancelled the booking', () => {
    let s = seed()
    const bk = s.bookings.find(b => b.id === 'bk3')
    s = ops.cancelBooking(s, admin, { id: 'bk3', reason: 'Needed for seminar' }).state
    const { result, state } = ops.saveEvent(s, admin, { kind: 'seminar', title: 'AI and Future Technology Seminar', committee: 'CSI', date: bk.date, start: '11:00', end: '13:00', roomId: 'Seminar Hall 2', seatsTotal: 100 })
    expect(result.ok).toBe(true)
    expect(state.notifications[0].title).toMatch(/New Seminar/)
  })
  it('a lecture in the chosen room is reported as a conflict', () => {
    const s = seed()
    const date = addDays(TODAY, 1)
    const blk = getOccupancies(s, date).find(b => b.source === 'lecture')
    const { result } = ops.saveEvent(s, admin, { kind: 'event', title: 'Quiz', committee: 'X', date, start: blk.start, end: blk.end, roomId: blk.roomId })
    expect(result.ok).toBe(false)
    expect(result.conflicts[0].block.source).toBe('lecture')
  })
  it('teachers cannot create seminars', () => {
    expect(ops.saveEvent(seed(), kulkarni, { kind: 'seminar', title: 'T', committee: 'C', date: addDays(TODAY, 20), start: '10:00', end: '11:00', roomId: 'Seminar Hall 1' }).result.ok).toBe(false)
  })
})

describe('9. admin can publish timetable updates for every department and division', () => {
  it('publishes to students and faculty across all departments and divisions', () => {
    const s = seed()
    const { state, result } = ops.publishTimetable(s, admin, { deptId: 'all', semester: 'all' })
    expect(result.ok).toBe(true)
    const groups = state.notifications[0].audience.students.groups
    expect(groups.some(g => g.deptId === 'comp' && g.semester === 'SEM III' && g.division === 'C1')).toBe(true)
    expect(groups.some(g => g.deptId === 'extc' && g.semester === 'SEM III' && g.division === '')).toBe(true)
    expect(state.notifications[0].audience.faculty.deptIds.length).toBeGreaterThan(1)
  })
})

describe('10. admin approves / rejects a teacher request', () => {
  it('approval publishes the change and notifies students + the teacher; re-checks conflicts', () => {
    const s = seed()
    const req = s.requests.find(r => r.status === 'pending')
    expect(req).toBeTruthy()
    const { state, result } = ops.decideRequest(s, admin, { requestId: req.id, decision: 'approve' }, ctx)
    expect(result.ok).toBe(true)
    expect(state.requests.find(r => r.id === req.id).status).toBe('approved')
    const lec = state.lectures.find(l => l.id === req.lectureId)
    expect(entryFor(state, lec, req.date).status).toBe('rescheduled')
    expect(state.notifications.some(n => n.kind === 'decision' && isRecipient(kulkarni, n))).toBe(true)
  })
  it('refuses approval if the room was taken in the meantime', () => {
    let s = seed()
    const req = s.requests.find(r => r.status === 'pending')
    const p = req.proposal
    s = ops.setSettings(s, admin, {}).state
    s = ops.createBooking(s, admin, { roomId: p.newRoomId, date: p.newDate, start: p.newStart, end: p.newEnd, purpose: 'Taken', faculty: 'Office' }, ctx).state
    const { result } = ops.decideRequest(s, admin, { requestId: req.id, decision: 'approve' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/no longer be approved/)
  })
  it('rejection needs a reason; only admins may decide', () => {
    const s = seed()
    const req = s.requests.find(r => r.status === 'pending')
    expect(ops.decideRequest(s, admin, { requestId: req.id, decision: 'reject', note: '' }, ctx).result.ok).toBe(false)
    expect(ops.decideRequest(s, kulkarni, { requestId: req.id, decision: 'approve' }, ctx).result.ok).toBe(false)
    const ok = ops.decideRequest(s, admin, { requestId: req.id, decision: 'reject', note: 'Hall busy' }, ctx)
    expect(ok.state.requests.find(r => r.id === req.id).decision.reason).toBe('Hall busy')
  })
})

describe('10/11. students see changes but cannot change anything', () => {
  it('published change is visible in the right class timetable only', () => {
    const s0 = seed()
    const compEntry = getDaySchedule(s0, addDays(TODAY, 1)).find(e => e.lecture.deptId === 'comp' && e.lecture.semester === 'SEM V' && e.lecture.division === 'C1')
    const room = freeRoomFor(s0, compEntry, addDays(TODAY, 1))
    const { state } = ops.submitLectureChange(s0, admin, { type: 'change', lectureId: compEntry.lecture.id, date: addDays(TODAY, 1), newRoomId: room.id, reason: 'AC repair' }, ctx)
    const seen = getDaySchedule(state, addDays(TODAY, 1)).find(e => e.lecture.id === compEntry.lecture.id)
    expect(seen.status).toBe('rescheduled')
    expect(seen.original.roomId).toBe(compEntry.lecture.roomId) // original still shown
    const n = state.notifications[0]
    expect(isRecipient(studentComp, n)).toBe(true)
    expect(isRecipient(studentIt, n)).toBe(false)
  })
  it('every write operation refuses a student', () => {
    const s = seed()
    const { entry, date } = nextOwnLecture(s, kulkarni.name)
    const l = entry.lecture
    const tries = [
      ops.submitLectureChange(s, studentComp, { type: 'cancel', lectureId: l.id, date, reason: 'x' }, ctx),
      ops.createBooking(s, studentComp, { roomId: 'C-306', date, start: '16:00', end: '17:00', purpose: 'x', faculty: 'x' }, ctx),
      ops.saveLecture(s, studentComp, { ...l, reason: 'x' }, ctx),
      ops.saveEvent(s, studentComp, { kind: 'event', title: 'x', committee: 'x', date, start: '10:00', end: '11:00', roomId: 'Seminar Hall 1' }),
      ops.decideRequest(s, studentComp, { requestId: s.requests[0].id, decision: 'approve' }, ctx),
      ops.setSettings(s, studentComp, { seminarHallBooking: 'direct' }),
    ]
    for (const t of tries) { expect(t.result.ok).toBe(false); expect(t.state).toBe(s) }
  })
  it("a teacher cannot change another teacher's lecture", () => {
    const s = seed()
    const { entry, date } = nextOwnLecture(s, shah.name)
    expect(ops.submitLectureChange(s, kulkarni, { type: 'cancel', lectureId: entry.lecture.id, date, reason: 'x' }, ctx).result.ok).toBe(false)
  })
})

describe('12. a page refresh does not lose changes', () => {
  it('state written by commit() is what loadState() returns next time', () => {
    const storage = memoryStorage()
    const { entry, date } = nextOwnLecture(loadState(storage, seed), kulkarni.name)
    const saved = commit(storage, s => ops.createBooking(s, admin, { roomId: 'C-306', date, start: '16:00', end: '17:00', purpose: 'Persist me', faculty: 'Office' }, ctx), seed)
    expect(saved.result.ok).toBe(true)
    const afterRefresh = loadState(storage, seed)
    expect(afterRefresh.bookings.some(b => b.purpose === 'Persist me')).toBe(true)
    expect(entry).toBeTruthy()
  })
  it('corrupt storage falls back to fresh demo data instead of crashing', () => {
    const storage = memoryStorage()
    storage.setItem('tsecsync_state_v2', '{not json')
    expect(loadState(storage, seed).lectures.length).toBe(199)
  })
})

describe('13. cancelled things stop occupying rooms', () => {
  it('a cancelled lecture frees its room; a cancelled booking is no longer an active booking', () => {
    let s = seed()
    const { entry, date } = nextOwnLecture(s, kulkarni.name)
    const l = entry.lecture
    s = ops.setSettings(s, admin, { teacherRules: { cancel: 'direct' } }).state
    expect(findConflicts(s, { date, start: l.start, end: l.end, roomId: l.roomId }).length).toBeGreaterThan(0)
    s = ops.submitLectureChange(s, kulkarni, { type: 'cancel', lectureId: l.id, date, reason: 'Leave' }, ctx).state
    expect(findConflicts(s, { date, start: l.start, end: l.end, roomId: l.roomId }).some(c => c.type === 'room')).toBe(false)
    const bk = s.bookings.find(b => b.id === 'bk2')
    s = ops.cancelBooking(s, kulkarni, { id: 'bk2', reason: 'Not needed' }).state
    expect(getOccupancies(s, bk.date).some(b => b.id === 'bk2')).toBe(false)
  })
  it('a pending booking does not block the room until approved', () => {
    const s = seed()
    const pend = s.bookings.find(b => b.status === 'pending')
    expect(getOccupancies(s, pend.date).some(b => b.id === pend.id)).toBe(false)
  })
})

describe('14. two simultaneous booking attempts cannot reserve the same room', () => {
  it('the second attempt (even from a stale tab) sees the first and is rejected', () => {
    const storage = memoryStorage()
    saveState(storage, seed())
    const tabA = loadState(storage, seed) // both tabs loaded the same snapshot
    const tabB = loadState(storage, seed)
    expect(tabA.rev).toBe(tabB.rev)
    const req = { roomId: 'C-306', date: addDays(TODAY, 4), start: '16:00', end: '17:00', purpose: 'First', faculty: 'x' }
    const first = commit(storage, s => ops.createBooking(s, admin, req, ctx), seed)
    const second = commit(storage, s => ops.createBooking(s, kulkarni, { ...req, purpose: 'Second' }, ctx), seed)
    expect(first.result.ok).toBe(true)
    expect(second.result.ok).toBe(false)
    const final = loadState(storage, seed)
    expect(final.bookings.filter(b => b.roomId === 'C-306' && b.date === req.date)).toHaveLength(1)
  })
})

describe('restore / audit / history', () => {
  it('admin can restore the regular schedule; history records who, what, when, why', () => {
    const s0 = seed()
    const { entry, date } = nextOwnLecture(s0, kulkarni.name)
    let s = ops.submitLectureChange(s0, admin, { type: 'cancel', lectureId: entry.lecture.id, date, reason: 'Holiday' }, ctx).state
    expect(s.audit[0]).toMatchObject({ by: admin.name, action: 'lecture.cancel', reason: 'Holiday' })
    expect(typeof s.audit[0].at).toBe('string')
    s = ops.restoreLecture(s, admin, { lectureId: entry.lecture.id, date, reason: 'Holiday cancelled' }, ctx).state
    expect(entryFor(s, entry.lecture, date).status).toBe('scheduled')
  })
  it('lectures cannot be changed for past dates', () => {
    const s = seed()
    const lec = s.lectures.find(l => l.weekday === 'Monday')
    expect(ops.submitLectureChange(s, admin, { type: 'cancel', lectureId: lec.id, date: '2026-10-12', reason: 'x' }, ctx).result.message).toMatch(/Past/)
  })
})
