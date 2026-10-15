// Role permissions.
//
// These checks live inside the store operations (store/operations.js). In production those operations
// run ON THE SERVER (server/state.js) with the actor taken from the server-side session, so they are
// real authorization. The same code also runs in the browser only for UI hints and in tests.
export const ROLE_LABELS = { student: 'Student', teacher: 'Teacher', management: 'Administrator' }
export const isAdmin = u => u?.role === 'management'
export const isTeacher = u => u?.role === 'teacher'

export function can(user, action, ctx = {}) {
  if (!user) return false
  if (user.role === 'management') return true
  if (user.role === 'teacher') {
    switch (action) {
      case 'lecture.change':
      case 'lecture.cancel':
        // teachers may only touch lectures assigned to them
        return ctx.lecture ? ctx.lecture.faculty === user.name : true
      case 'booking.create':
      case 'lecture.add.request':
      case 'seminar.propose':
        return true
      case 'booking.manage':
        return ctx.booking ? ctx.booking.createdBy?.email === user.email : true
      default:
        return false // timetable.edit, event.manage, request.decide, settings.edit, audit.view ...
    }
  }
  return false // students are read-only
}

export const defaultSettings = {
  // 'direct' = applied immediately if conflict-free, 'approval' = goes to an admin first
  teacherRules: { roomChange: 'direct', reschedule: 'approval', cancel: 'approval' },
  seminarHallBooking: 'approval',
}

export function teacherNeedsApproval(settings, kind) {
  return (settings.teacherRules?.[kind] ?? 'approval') === 'approval'
}
