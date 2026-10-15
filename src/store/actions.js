// The complete list of actions that can change shared data, and which ROLE may invoke each.
// Used by the server (authoritative) and by the in-memory backend in tests, so they can never disagree.
import * as ops from './operations.js'

export const ACTIONS = {
  changeLecture: (s, u, i, c) => ops.submitLectureChange(s, u, { ...i, type: 'change' }, c),
  cancelLecture: (s, u, i, c) => ops.submitLectureChange(s, u, { ...i, type: 'cancel' }, c),
  restoreLecture: ops.restoreLecture, decideRequest: ops.decideRequest,
  createBooking: ops.createBooking, updateBooking: ops.updateBooking, cancelBooking: ops.cancelBooking, decideBooking: ops.decideBooking,
  saveEvent: ops.saveEvent, cancelEvent: ops.cancelEvent,
  saveLecture: ops.saveLecture, deleteLecture: ops.deleteLecture, bulkCancelDay: ops.bulkCancelDay, publishTimetable: ops.publishTimetable,
  setSettings: ops.setSettings,
  requestNewLecture: ops.requestNewLecture, proposeSeminar: ops.proposeSeminar, updateSeminarProposal: ops.updateSeminarProposal, decideSeminar: ops.decideSeminar,
  markRead: (s, u, i) => ops.markRead(s, u, i.ids),
}
export const ACTION_NAMES = Object.keys(ACTIONS)

// Coarse role gate in FRONT of each operation's own permission checks (defence in depth; HTTP 403 on the server).
const ADMIN_ONLY = new Set(['restoreLecture', 'decideRequest', 'decideBooking', 'decideSeminar', 'saveEvent', 'cancelEvent', 'saveLecture', 'deleteLecture', 'bulkCancelDay', 'publishTimetable', 'setSettings'])
const TEACHER_OK = new Set(['changeLecture', 'cancelLecture', 'createBooking', 'updateBooking', 'cancelBooking', 'requestNewLecture', 'proposeSeminar', 'updateSeminarProposal', 'markRead'])
const TEACHER_ONLY = new Set(['requestNewLecture', 'proposeSeminar', 'updateSeminarProposal'])
export function roleAllows(role, name) {
  if (role === 'management') return !TEACHER_ONLY.has(name)
  if (role === 'teacher') return TEACHER_OK.has(name) && !ADMIN_ONLY.has(name)
  return name === 'markRead'
}
