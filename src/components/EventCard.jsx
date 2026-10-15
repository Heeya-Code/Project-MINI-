import StatusBadge from './StatusBadge'
import { formatRange, parseISO } from '../utils/dates'
import { eventKindLabel, roomById } from '../utils/lookup'

// Used for every kind of event (seminar, workshop, guest lecture, college event).
export default function EventCard({ event, onEdit, onCancel }) {
  const d = parseISO(event.date)
  const room = roomById(event.roomId)
  const cancelled = event.status === 'cancelled'
  const seatsLabel = event.seatsAvailable === 0 ? 'Full' : 'Open'
  return (
    <div className={`card event-card ${cancelled ? 'is-cancelled' : ''}`}>
      <div className="event-head">
        <div className="event-date-badge"><span className="d">{d.getDate()}</span><span className="m">{d.toLocaleDateString('en-IN', { month: 'short' })}</span></div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0 }} className={cancelled ? 'strike' : ''}>{event.title}</h4>
          <div className="tt-cell-meta">{eventKindLabel(event.kind)} · {formatRange(event.start, event.end)}</div>
        </div>
        {cancelled ? <StatusBadge status="cancelled" /> : event.kind === 'seminar' && <StatusBadge status={seatsLabel} />}
      </div>
      {event.description && <p style={{ margin: 0, fontSize: 13 }}>{event.description}</p>}
      {event.speaker && <div className="tt-cell-meta">Speaker: {event.speaker}</div>}
      <div className="tt-cell-meta">{event.roomId} · {room?.floor} · {room?.building}</div>
      <div className="tt-cell-meta">Organized by {event.committee}</div>
      {event.attendanceRequired && !cancelled && <span className="chip chip-warn">Attendance compulsory</span>}
      {event.kind === 'seminar' && !cancelled && <div style={{ fontSize: 13, fontWeight: 600 }}>{event.seatsAvailable} / {event.seatsTotal} seats available</div>}
      {cancelled && event.cancelReason && <div className="tt-cell-meta">Reason: {event.cancelReason}</div>}
      {(onEdit || onCancel) && !cancelled && (
        <div className="btn-row" style={{ marginTop: 4, justifyContent: 'flex-start' }}>
          {onEdit && <button className="btn btn-outline btn-sm" onClick={() => onEdit(event)}>Edit</button>}
          {onCancel && <button className="btn btn-danger btn-sm" onClick={() => onCancel(event)}>Cancel</button>}
        </div>
      )}
    </div>
  )
}
