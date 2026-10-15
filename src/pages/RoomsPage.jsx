import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import RoomCard from '../components/RoomCard'
import BuildingCard from '../components/BuildingCard'
import DashboardCard from '../components/DashboardCard'
import { buildings, rooms, roomTypes } from '../data/rooms'
import { roomStatuses } from '../utils/schedule'
import { nowHHMM, toHHMM, toMinutes, todayISO } from '../utils/dates'
import { buildingStats } from './ManagementDashboard'

function defaultWindow() {
  const now = nowHHMM()
  const start = toMinutes(now) >= 9 * 60 && toMinutes(now) < 17 * 60 ? now : '10:00'
  return [start, toHHMM(toMinutes(start) + 60)]
}

// Availability is computed from EVERYTHING that occupies a room (lectures, bookings,
// seminars/events), not just bookings — so it matches what the booking form enforces.
export default function RoomsPage() {
  const { state } = useData()
  const [initialStart, initialEnd] = defaultWindow()
  const [building, setBuilding] = useState('')
  const [type, setType] = useState('')
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const valid = start && end && toMinutes(end) > toMinutes(start) && date
  const statuses = useMemo(() => (valid ? roomStatuses(state, date, start, end) : null), [state, date, start, end, valid])
  const filtered = statuses ? rooms.filter(r =>
    (!building || r.building === building) && (!type || r.type === type) &&
    (!search || r.id.toLowerCase().includes(search.toLowerCase())) && (!status || statuses[r.id].status === status)) : []

  return (
    <div className="stack">
      {statuses && (
        <div className="grid grid-2">
          {buildings.map(b => <BuildingCard key={b} name={b} stats={buildingStats(b, statuses)} />)}
        </div>
      )}
      <DashboardCard title="Room Availability">
        <div className="filter-bar">
          <select aria-label="Building" value={building} onChange={e => setBuilding(e.target.value)}><option value="">All buildings</option>{buildings.map(b => <option key={b}>{b}</option>)}</select>
          <select aria-label="Room type" value={type} onChange={e => setType(e.target.value)}><option value="">All room types</option>{roomTypes.map(t => <option key={t}>{t}</option>)}</select>
          <select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="">Any status</option><option>Available</option><option>Occupied</option><option>Reserved</option></select>
          <input aria-label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input aria-label="From" type="time" value={start} onChange={e => setStart(e.target.value)} />
          <input aria-label="To" type="time" value={end} onChange={e => setEnd(e.target.value)} />
          <input aria-label="Search room" placeholder="Search room…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {!valid && <div className="form-msg form-msg-error">Choose a date and a time range where the end is after the start.</div>}
        {valid && filtered.length === 0 && <div className="empty-state"><div className="glyph">{'\u25A3'}</div>No rooms match these filters.</div>}
        <div className="grid grid-3">
          {filtered.map(r => <RoomCard key={r.id} room={r} status={statuses[r.id].status} occupant={statuses[r.id].occupant} />)}
        </div>
      </DashboardCard>
    </div>
  )
}
