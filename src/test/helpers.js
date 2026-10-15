import { buildSeedState } from '../store/seed'
import { mockUsers } from '../data/users'
import { addDays, isWorkingDay } from '../utils/dates'
import { getDaySchedule, suggestAlternatives } from '../utils/schedule'

// Fixed "today" (a Wednesday) so tests never depend on the real date.
export const TODAY = '2026-10-14'
export const ctx = { today: TODAY }
export const seed = () => buildSeedState(TODAY)
export const user = email => mockUsers.find(u => u.email === email)
export const admin = user('admin@tsec.edu')
export const kulkarni = user('teacher@tsec.edu')
// A second teacher who actually has seeded lectures (the IT demo lectures were removed; IT now uses official PDFs).
export const shah = { email: 'teacher.deshpande@tsec.edu', role: 'teacher', name: 'Prof. A. Deshpande', department: 'comp' }
export const studentComp = user('student@tsec.edu')
export const studentIt = user('student.it@tsec.edu')

export const run = (state, fn, actor, input, c = ctx) => fn(state, actor, input, c)

// First upcoming occurrence (after today) of a lecture taught by `name` that is still regular.
export function nextOwnLecture(state, name, from = TODAY, days = 14) {
  for (let i = 1; i <= days; i++) {
    const date = addDays(from, i)
    if (!isWorkingDay(date)) continue
    const waiting = x => state.requests.some(r => r.status === 'pending' && r.lectureId === x.lecture.id && r.date === date)
    const e = getDaySchedule(state, date).find(x => x.lecture.faculty === name && x.status === 'scheduled' && !waiting(x))
    if (e) return { entry: e, date }
  }
  throw new Error('no lecture found')
}
export function freeRoomFor(state, entry, date) {
  const l = entry.lecture
  const alts = suggestAlternatives(state, { date, start: l.start, end: l.end, roomId: l.roomId, faculty: l.faculty, deptId: l.deptId, semester: l.semester, division: l.division }, { source: 'lecture', id: l.id })
  return alts.rooms[0]
}
