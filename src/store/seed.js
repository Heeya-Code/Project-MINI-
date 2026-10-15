// Builds the initial demo data. Everything date-related is relative to "today",
// so the demo is always current. Replace this file with real data / an API later.
import { facultyPool } from '../data/faculty.js'
import { rooms } from '../data/rooms.js'
import { mockUsers } from '../data/users.js'
import { seededClasses, subjectBanks, timeSlots } from '../data/timetable.js'
import { WEEKDAYS, addDays, isWorkingDay, nextWorkingDay, todayISO } from '../utils/dates.js'
import { defaultSettings } from '../utils/permissions.js'
import { getDaySchedule, suggestAlternatives } from '../utils/schedule.js'
import { roomById } from '../utils/lookup.js'
import { submitLectureChange } from './operations.js'

export const STATE_VERSION = 2

// Greedy generator: places every class's lectures so that no room, teacher or
// class group is ever double-booked. (The original app had 80 room clashes.)
export function generateLectures() {
  const lectures = []
  const lectureRooms = rooms.filter(r => r.type !== 'Seminar Hall')
  const busyRoom = {}
  const busyFaculty = {}
  const subjectsUsed = {}
  WEEKDAYS.forEach((day, dIdx) => {
    timeSlots.forEach((slot, sIdx) => {
      const key = `${day}|${slot.id}`
      busyRoom[key] = new Set()
      busyFaculty[key] = new Set()
      seededClasses.forEach((cls, cIdx) => {
        const bank = subjectBanks[cls.deptId][cls.semester]
        const pool = facultyPool[cls.deptId]
        const divisionOrder = ['C1', 'C2', 'C3']
        const divisionIndex = divisionOrder.indexOf(cls.division)
        const legacyIndex = Math.max(0, cls.division === 'B' ? 1 : cls.division === 'A' ? 0 : divisionIndex) // '' (no divisions) -> 0
        const used = (subjectsUsed[`${cls.deptId}|${cls.semester}|${cls.division}|${day}`] ||= new Set())
        const first = (dIdx * 4 + sIdx + cIdx * 2) % bank.length
        for (let t = 0; t < bank.length; t++) {
          const bi = (first + t) % bank.length
          const subject = bank[bi]
          if (used.has(subject.name)) continue
          const faculty = pool[(bi + (cls.semester === 'SEM V' ? 3 : 0) + legacyIndex) % pool.length]
          if (busyFaculty[key].has(faculty)) continue
          const preferred = lectureRooms.filter(r => (subject.roomType ? r.type === subject.roomType : r.type === 'Classroom'))
          const room = [...preferred, ...lectureRooms].find(r => !busyRoom[key].has(r.id))
          if (!room) continue
          busyRoom[key].add(room.id)
          busyFaculty[key].add(faculty)
          used.add(subject.name)
          lectures.push({
            id: `lec-${cls.deptId}-${cls.semester.replace('SEM ', '')}${cls.division}-${day.slice(0, 3)}${slot.id}`,
            deptId: cls.deptId, semester: cls.semester, division: cls.division,
            subject: subject.name, faculty, weekday: day, start: slot.start, end: slot.end,
            roomId: room.id, slotId: slot.id,
          })
          break
        }
      })
    })
  })
  return lectures
}

const workingDayAfter = (today, n) => {
  let d = today
  let c = 0
  while (c < n) { d = addDays(d, 1); if (isWorkingDay(d)) c++ }
  return d
}
const workingDayBefore = (today, n) => {
  let d = today
  let c = 0
  while (c < n) { d = addDays(d, -1); if (isWorkingDay(d)) c++ }
  return d
}

// `skipDepts`: departments whose lectures come from OFFICIAL timetables (the server skips the invented demo ones).
export function buildSeedState(today = todayISO(), { skipDepts = [] } = {}) {
  const admin = mockUsers.find(u => u.role === 'management')
  const teacher = mockUsers.find(u => u.email === 'teacher@tsec.edu')
  const wd = n => workingDayAfter(today, n)
  const ctx = { today }
  const someone = (name, email) => ({ name, email })

  let state = {
    version: STATE_VERSION, rev: 0, seq: 100,
    lectures: generateLectures().filter(l => !skipDepts.includes(l.deptId)), exceptions: [], requests: [], notifications: [], audit: [], reads: {},
    settings: JSON.parse(JSON.stringify(defaultSettings)),
    bookings: [
      { id: 'bk1', roomId: 'C-301', date: workingDayBefore(today, 1), start: '16:00', end: '17:00', purpose: 'Revision class — Data Structures', faculty: 'Dr. Rupali Sarode', deptId: 'comp', status: 'approved', createdBy: someone('Dr. Rupali Sarode', 'teacher@tsec.edu'), createdAt: today, decision: null },
      { id: 'bk2', roomId: 'C-304', date: wd(1), start: '16:00', end: '17:00', purpose: 'Extra lecture — Data Structures doubt session', faculty: 'Dr. Rupali Sarode', deptId: 'comp', status: 'approved', createdBy: someone('Dr. Rupali Sarode', 'teacher@tsec.edu'), createdAt: today, decision: null },
      // Used in the seminar-conflict demo: create a seminar in Seminar Hall 2 on this date, 11:00–13:00.
      { id: 'bk3', roomId: 'Seminar Hall 2', date: wd(2), start: '12:00', end: '13:00', purpose: 'Remedial Mathematics session', faculty: 'Dr. A. Banerjee (visiting)', deptId: 'chem', status: 'approved', createdBy: someone('Dr. S. Iyer', 'admin@tsec.edu'), createdAt: today, decision: null },
      { id: 'bk4', roomId: 'Seminar Hall 3', date: wd(3), start: '15:00', end: '16:00', purpose: 'Department orientation talk', faculty: 'Dr. Rupali Sarode', deptId: 'comp', status: 'pending', createdBy: someone('Dr. Rupali Sarode', 'teacher@tsec.edu'), createdAt: today, decision: null },
      { id: 'bk5', roomId: 'Seminar Hall 2', date: wd(1), start: '10:00', end: '11:00', purpose: 'Club meeting', faculty: 'Dr. Rupali Sarode', deptId: 'comp', status: 'rejected', createdBy: someone('Dr. Rupali Sarode', 'teacher@tsec.edu'), createdAt: today, decision: { by: 'Dr. S. Iyer', at: today, reason: 'Hall reserved for rehearsal.' } },
    ],
    events: [
      { id: 'ev-sm1', kind: 'seminar', title: 'AI in Modern Software Development', speaker: 'Dr. Rajesh Menon', committee: 'Computer Engineering Department', description: 'How AI assistants are changing the way software is designed, written and tested.', date: wd(4), start: '11:00', end: '13:00', roomId: 'Seminar Hall 2', seatsTotal: 120, seatsAvailable: 42, audience: { deptId: 'comp', semester: 'all' }, attendanceRequired: false, status: 'scheduled' },
      { id: 'ev-fest', kind: 'event', title: 'TechFest 2026', speaker: '', committee: 'Technical Committee', description: 'Inter-college showcase of student projects, robotics demos and the hackathon final round.', date: wd(5), start: '10:00', end: '16:00', roomId: 'Seminar Hall 1', seatsTotal: 150, seatsAvailable: 87, audience: { deptId: 'all', semester: 'all' }, attendanceRequired: false, status: 'scheduled' },
      { id: 'ev-sm2', kind: 'seminar', title: 'Sustainable Process Design', speaker: 'Prof. Leela Nair', committee: 'Chemical Engineering Department', description: 'Designing greener chemical processes: energy integration and waste minimisation.', date: wd(6), start: '14:00', end: '16:00', roomId: 'Seminar Hall 1', seatsTotal: 150, seatsAvailable: 0, audience: { deptId: 'chem', semester: 'all' }, attendanceRequired: false, status: 'scheduled' },
      { id: 'ev-sm3', kind: 'seminar', title: 'Signal Processing for 5G Networks', speaker: 'Dr. Ahmed Sheikh', committee: 'EXTC Department', description: 'Modulation, MIMO and beamforming in modern 5G radio systems.', date: wd(7), start: '10:00', end: '12:00', roomId: 'Seminar Hall 2', seatsTotal: 120, seatsAvailable: 65, audience: { deptId: 'extc', semester: 'all' }, attendanceRequired: false, status: 'scheduled' },
      { id: 'ev-ws1', kind: 'workshop', title: 'Circuit Design Workshop', speaker: 'Prof. D. Menon', committee: 'EXTC Department', description: 'Hands-on PCB design and simulation session.', date: wd(8), start: '15:00', end: '17:00', roomId: 'EXTC-305', seatsTotal: 35, seatsAvailable: 12, audience: { deptId: 'extc', semester: 'SEM V' }, attendanceRequired: false, status: 'scheduled' },
      { id: 'ev-gl1', kind: 'guest_lecture', title: 'Guest Lecture: Careers in Cloud Engineering', speaker: 'Ms. Priya Nambiar (industry guest)', committee: 'Computer Engineering Department', description: 'Compulsory for COMP SEM V — overlapping lectures are flagged automatically.', date: wd(9), start: '15:15', end: '16:15', roomId: 'Seminar Hall 1', seatsTotal: 150, seatsAvailable: 70, audience: { deptId: 'comp', semester: 'SEM V' }, attendanceRequired: true, status: 'scheduled' },
      { id: 'ev-alumni', kind: 'event', title: 'Alumni Meet 2026', speaker: '', committee: 'Alumni Relations Cell', description: 'Annual gathering with panels on placements and higher studies.', date: wd(11), start: '17:00', end: '19:30', roomId: 'Seminar Hall 2', seatsTotal: 120, seatsAvailable: 95, audience: { deptId: 'all', semester: 'all' }, attendanceRequired: false, status: 'scheduled' },
    ],
  }

  // A couple of realistic schedule changes, created through the SAME operations the UI uses,
  // so the notifications and audit history are real, not hand-written.
  const dayX = nextWorkingDay(today)
  const compSem5 = getDaySchedule(state, dayX)
    .filter(e => e.lecture.deptId === 'comp' && e.lecture.semester === 'SEM V')
    .sort((a, b) => a.lecture.start.localeCompare(b.lecture.start))
  const compCI = compSem5.find(e => e.lecture.division === 'C1') || compSem5[1] || compSem5[0]
  if (compCI) {
    const e = compCI
    const division = e.lecture.division
    const alts = suggestAlternatives(state, { date: dayX, start: e.lecture.start, end: e.lecture.end, roomId: e.lecture.roomId, faculty: e.lecture.faculty, deptId: 'comp', semester: 'SEM V', division }, { source: 'lecture', id: e.lecture.id })
    // prefer a room in the OTHER building so the demo shows a building change
    const target = alts.rooms.find(r => r.building !== roomById(e.lecture.roomId).building) || alts.rooms[0]
    if (target) state = submitLectureChange(state, admin, { type: 'change', lectureId: e.lecture.id, date: dayX, newRoomId: target.id, reason: 'Original room unavailable due to maintenance work.' }, ctx).state
    const cancelTarget = compSem5.find(x => x.lecture.id !== e.lecture.id && x.lecture.division === division) || compSem5.find(x => x.lecture.id !== e.lecture.id)
    if (cancelTarget) {
      state = submitLectureChange(state, admin, { type: 'cancel', lectureId: cancelTarget.lecture.id, date: dayX, reason: 'Faculty on approved leave.' }, ctx).state
    }
  }
  // A teacher's pending reschedule request, waiting for admin approval.
  for (let n = 1; n <= 5; n++) {
    const date = wd(n)
    const mine = getDaySchedule(state, date).find(e => e.lecture.faculty === teacher.name && e.status === 'scheduled')
    if (!mine) continue
    const alts = suggestAlternatives(state, { date, start: mine.lecture.start, end: mine.lecture.end, roomId: mine.lecture.roomId, faculty: teacher.name, deptId: mine.lecture.deptId, semester: mine.lecture.semester, division: mine.lecture.division }, { source: 'lecture', id: mine.lecture.id })
    const slot = alts.slots[0]
    if (slot) {
      state = submitLectureChange(state, teacher, { type: 'change', lectureId: mine.lecture.id, date, newDate: slot.date, newStart: slot.start, newEnd: slot.end, newRoomId: slot.roomId, reason: 'Clashes with a department meeting.' }, ctx).state
    }
    break
  }
  return state
}
