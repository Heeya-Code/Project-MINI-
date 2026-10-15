import { rooms } from '../data/rooms.js'
import { departments } from '../data/departments.js'

// Room codes that appear on the OFFICIAL timetable sheets (e.g. 1004, 906, OB 308) are not in the mock
// inventory. The server registers them here so they are valid for conflict checks — but arbitrary
// strings still are not valid rooms.
let extraRooms = []
export const setExtraRooms = list => { extraRooms = Array.isArray(list) ? list : [] }
export const getExtraRooms = () => extraRooms
export const roomById = id => rooms.find(r => r.id === id) || extraRooms.find(r => r.id === id)
export const deptShort = id => id === 'all' ? 'All' : departments.find(d => d.id === id)?.short || id
export const deptName = id => id === 'all' ? 'All departments' : departments.find(d => d.id === id)?.name || id
export const classLabel = l => `${deptShort(l.deptId)} ${l.semester}${l.division ? ` · Div ${l.division}` : ''}`
export function roomLabel(id) {
  if (!id) return 'Room not listed'
  const r = roomById(id)
  return r ? [r.id, r.building, r.floor].filter(Boolean).join(' · ') : id
}

export const eventKinds = {
  seminar: 'Seminar', workshop: 'Workshop', guest_lecture: 'Guest Lecture', event: 'College Event',
}
export const eventKindLabel = k => eventKinds[k] || 'Event'
