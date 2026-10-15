// Who should receive a notification?
// A notification carries an `audience`:
//   students: { all: true } | { groups: [{deptId, semester, division}] }   ('*' = any)
//   faculty:  { all: true } | { names: [...] } | { deptIds: [...] }
//   management: true
// isRecipient() lets each user see ONLY the notifications meant for them.
const star = (a, b) => a === '*' || !a || a === b

export function isRecipient(user, n) {
  const a = n.audience || {}
  if (!user) return false
  if (user.role === 'management') return !!a.management
  if (user.role === 'teacher') {
    const f = a.faculty
    if (!f) return false
    return !!f.all || !!f.names?.includes(user.name) || !!f.deptIds?.includes(user.department)
  }
  const s = a.students
  if (!s) return false
  if (s.all) return true
  return !!s.groups?.some(g => star(g.deptId, user.department) && star(g.semester, user.semester) && star(g.division, user.division))
}

export function audienceForEvent(ev) {
  const dept = ev.audience?.deptId
  const sem = ev.audience?.semester
  if (!dept || dept === 'all') return { students: { all: true }, faculty: { all: true } }
  return {
    students: { groups: [{ deptId: dept, semester: !sem || sem === 'all' ? '*' : sem, division: '*' }] },
    faculty: { deptIds: [dept] },
  }
}

export function audienceForLecture(lecture, extraFaculty = []) {
  return {
    students: { groups: [{ deptId: lecture.deptId, semester: lecture.semester, division: lecture.division }] },
    faculty: { names: [...new Set([lecture.faculty, ...extraFaculty].filter(Boolean))] },
  }
}

// Category + deep link of a notification (used by the filters and by click-through in the notification centre).
export const CATEGORY_LABELS = { timetable: 'Timetable', requests: 'Requests', seminars: 'Seminars & events', bookings: 'Bookings' }
export function categoryFor(n) {
  if (n.category) return n.category
  if (/booking/i.test(n.title || '')) return 'bookings'
  if (n.kind === 'seminar' || /seminar/i.test(n.title || '')) return 'seminars'
  if (n.kind === 'request' || n.kind === 'decision') return 'requests'
  return 'timetable'
}
export function defaultLink(n) {
  switch (n.category) {
    case 'requests': return '/app/requests'
    case 'seminars': return '/app/seminars'
    case 'bookings': return '/app/bookings'
    default: return '/app/timetable'
  }
}
