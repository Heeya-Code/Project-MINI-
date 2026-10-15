import { formatRange } from '../utils/dates'
import { conflictLabels } from '../utils/schedule'
import { roomLabel } from '../utils/lookup'

const SOURCE_LABEL = { lecture: 'Lecture', booking: 'Booking', event: 'Event' }

// Shown wherever a schedule would clash. Lists exactly what clashes and offers
// alternatives. `renderResolve(conflict)` lets a page add an authorised
// one-click fix (e.g. an admin moving the clashing lecture).
export default function ConflictPanel({ conflicts, alternatives, onUseRoom, onUseSlot, renderResolve, title = 'Scheduling Conflict Detected' }) {
  if (!conflicts?.length) return null
  return (
    <div className="conflict-panel" role="alert">
      <div className="conflict-title">{'\u26A0'} {title}</div>
      <ul className="conflict-list">
        {conflicts.map((c, i) => (
          <li key={`${c.type}-${c.block.source}-${c.block.id}-${i}`}>
            <div><strong>{conflictLabels[c.type]}</strong></div>
            <div className="tt-cell-meta">
              {SOURCE_LABEL[c.block.source]}: {c.block.label} · {formatRange(c.block.start, c.block.end)} · {roomLabel(c.block.roomId)}
            </div>
            {renderResolve && <div style={{ marginTop: 6 }}>{renderResolve(c)}</div>}
          </li>
        ))}
      </ul>
      {alternatives && (alternatives.rooms?.length > 0 || alternatives.slots?.length > 0) && (
        <div className="conflict-alts">
          <div className="tt-cell-meta" style={{ fontWeight: 600 }}>Suggested alternatives</div>
          {alternatives.rooms?.length > 0 && (
            <div className="chip-row">
              {alternatives.rooms.map(r => (
                <button type="button" key={r.id} className="chip chip-btn" disabled={!onUseRoom} onClick={() => onUseRoom?.(r)}>
                  Use {r.id} ({r.building})
                </button>
              ))}
            </div>
          )}
          {alternatives.slots?.length > 0 && (
            <div className="chip-row">
              {alternatives.slots.map(s => (
                <button type="button" key={`${s.date}${s.start}${s.roomId}`} className="chip chip-btn" disabled={!onUseSlot} onClick={() => onUseSlot?.(s)}>
                  {s.date} · {formatRange(s.start, s.end)} · {s.roomId}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
