import StatusBadge from './StatusBadge'

export default function RoomCard({ room, status, occupant }) {
  return (
    <div className={`card ${room.building === 'Old Building' ? 'accent-old' : 'accent-new'}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <h4 style={{ margin: 0 }}>{room.id}</h4>
          <div className="tt-cell-meta">{room.building} · {room.floor}</div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="tt-cell-meta">{room.type} · Capacity {room.capacity}</div>
      {occupant && <div className="tt-cell-meta">{status === 'Reserved' ? 'Later: ' : 'Now: '}{occupant}</div>}
    </div>
  )
}
