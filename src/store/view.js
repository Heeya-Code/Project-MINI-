// What a given user is allowed to SEE of the shared state. Private data never leaves the server.
import { isRecipient } from '../utils/notifications.js'

export function viewFor(state, user) {
  const mgmt = user.role === 'management'
  const mine = e => e.proposedBy?.email === user.email
  const events = state.events.filter(e => (e.status === 'proposed' || e.status === 'rejected') ? (mgmt || mine(e)) : true)
  const bookings = user.role === 'student'
    ? state.bookings.filter(b => b.status === 'approved').map(b => ({ ...b, createdBy: { name: b.createdBy?.name } }))
    : state.bookings
  const requests = mgmt ? state.requests : user.role === 'teacher' ? state.requests.filter(r => r.requestedBy.email === user.email) : []
  return {
    version: state.version, rev: state.rev, officialRooms: state.officialRooms || [], settings: state.settings,
    lectures: state.lectures, exceptions: state.exceptions, bookings, events, requests,
    audit: mgmt ? state.audit : [],
    notifications: state.notifications.filter(n => isRecipient(user, n)).slice(0, 300),
    reads: { [user.email]: state.reads?.[user.email] || [] },
  }
}
