import { describe, it, expect } from 'vitest'
import { TODAY, seed } from './helpers'
import { findConflicts, findEventConflicts, getOccupancies, rangesOverlap, suggestAlternatives } from '../utils/schedule'
import { buildSeedState } from '../store/seed'
import { addDays, isWorkingDay } from '../utils/dates'
import { isRecipient } from '../utils/notifications'
import { diffLecture } from '../utils/changeDetection'

describe('overlap rules', () => {
  it('10:00–11:00 and 10:30–11:30 overlap', () => expect(rangesOverlap('10:00', '11:00', '10:30', '11:30')).toBe(true))
  it('consecutive 10:00–11:00 and 11:00–12:00 do NOT overlap', () => expect(rangesOverlap('10:00', '11:00', '11:00', '12:00')).toBe(false))
  it('is symmetric and handles containment', () => {
    expect(rangesOverlap('09:00', '13:00', '10:00', '11:00')).toBe(true)
    expect(rangesOverlap('10:00', '11:00', '09:00', '13:00')).toBe(true)
  })
})

describe('seed data is internally consistent (the original app had 80 room clashes)', () => {
  for (const today of ['2026-10-12', '2026-10-14', '2026-10-17', '2026-10-18', '2026-12-31']) {
    it(`no room / faculty / class double-booking for 21 days starting ${today}`, () => {
      const s = buildSeedState(today)
      expect(s.lectures.length).toBe(199)
      for (let i = 0; i < 21; i++) {
        const date = addDays(today, i)
        if (!isWorkingDay(date)) continue
        const blocks = getOccupancies(s, date)
        for (let a = 0; a < blocks.length; a++) {
          for (let b = a + 1; b < blocks.length; b++) {
            const x = blocks[a]; const y = blocks[b]
            if (!rangesOverlap(x.start, x.end, y.start, y.end)) continue
            expect(x.roomId === y.roomId, `room clash ${x.label} / ${y.label} on ${date}`).toBe(false)
            if (x.faculty && x.faculty === y.faculty) throw new Error(`faculty clash ${x.faculty} on ${date}`)
            if (x.source === 'lecture' && y.source === 'lecture' && x.deptId === y.deptId && x.semester === y.semester && x.division === y.division) {
              throw new Error(`class clash ${x.label} / ${y.label}`)
            }
          }
        }
      }
    })
  }
})

describe('one conflict engine for lectures, bookings and events', () => {
  it('a regular lecture blocks its room for bookings (original app bug)', () => {
    const s = seed()
    const date = '2026-10-15'
    const blk = getOccupancies(s, date).find(b => b.source === 'lecture')
    const c = findConflicts(s, { date, start: blk.start, end: blk.end, roomId: blk.roomId })
    expect(c.some(x => x.type === 'room')).toBe(true)
  })
  it('back-to-back booking right after a lecture is allowed', () => {
    const s = seed()
    const date = '2026-10-15'
    const blk = getOccupancies(s, date).find(b => b.source === 'lecture' && b.end === '15:00')
    const c = findConflicts(s, { date, start: '15:00', end: '16:00', roomId: blk.roomId })
    expect(c.filter(x => x.type === 'room')).toHaveLength(0)
  })
  it('seminar vs lecture in the same hall: detected, with alternative halls suggested', () => {
    const s = seed()
    const bk = s.bookings.find(b => b.id === 'bk3') // Seminar Hall 2, 12:00–13:00
    const ev = { date: bk.date, start: '11:00', end: '13:00', roomId: 'Seminar Hall 2', audience: { deptId: 'comp', semester: 'all' }, attendanceRequired: false }
    const conflicts = findEventConflicts(s, ev)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].block.start).toBe('12:00')
    const alts = suggestAlternatives(s, { date: ev.date, start: ev.start, end: ev.end, roomId: ev.roomId, minCapacity: 100 }, { source: 'event', id: '__draft__' })
    expect(alts.rooms.map(r => r.id)).toContain('Seminar Hall 1')
    expect(alts.slots.length).toBeGreaterThan(0)
  })
  it('a lecture in ANOTHER room is not a conflict unless attendance is compulsory', () => {
    const s = seed()
    const date = '2026-10-15'
    const lec = getOccupancies(s, date).find(b => b.source === 'lecture' && b.deptId === 'comp' && b.semester === 'SEM V')
    const ev = { date, start: lec.start, end: lec.end, roomId: 'Seminar Hall 1', audience: { deptId: 'comp', semester: 'SEM V' } }
    expect(findEventConflicts(s, { ...ev, attendanceRequired: false })).toHaveLength(0)
    const strict = findEventConflicts(s, { ...ev, attendanceRequired: true })
    expect(strict.length).toBeGreaterThan(0)
    expect(strict.every(c => c.type === 'audience')).toBe(true)
  })
})

describe('change detection', () => {
  it('reports every changed field', () => {
    const a = { date: TODAY, start: '10:00', end: '11:00', roomId: 'C-304', faculty: 'Dr. Rupali Sarode' }
    const b = { date: TODAY, start: '10:00', end: '11:00', roomId: 'N-204', faculty: 'Dr. Rupali Sarode' }
    expect(diffLecture(a, b).map(c => c.field)).toEqual(['Room', 'Building', 'Floor'])
  })
})

describe('notifications reach only the affected people', () => {
  it('seeded room change is visible to the COMP SEM V C1 student, not to the IT student', async () => {
    const { studentComp, studentIt } = await import('./helpers')
    const s = seed()
    const n = s.notifications.find(x => ['room_changed', 'building_changed'].includes(x.kind))
    expect(n).toBeTruthy()
    expect(isRecipient(studentComp, n)).toBe(true)
    expect(isRecipient(studentIt, n)).toBe(false)
  })
})
