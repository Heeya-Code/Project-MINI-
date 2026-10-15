import StatusBadge from './StatusBadge'
import { diffLecture } from '../utils/changeDetection'
import { formatDay, formatRange } from '../utils/dates'
import { deptName, roomById } from '../utils/lookup'

const where = (v, lecture) => {
  if (!v.roomId) return 'Room not listed'
  const r = roomById(v.roomId)
  const building = r?.building === 'Official timetable' ? 'Building not listed' : r?.building
  const roomType = r?.type || (/lab|practical/i.test(lecture.kind || '') ? 'Lab' : 'Classroom')
  return [v.roomId, roomType, building, r?.floor].filter(Boolean).join(' · ')
}

// One lecture occurrence. Regular classes look plain; changed ones show the
// ORIGINAL (struck through) and the UPDATED schedule side by side, plus the reason.
export default function LectureEntry({ entry, showClass = false, showDate = false, actions = null }) {
  const { lecture, status, original, effective, exception, movedOut, movedIn } = entry
  const changes = status === 'rescheduled' ? diffLecture(original, effective) : []
  const cls = status === 'cancelled' ? 'lec lec-cancelled' : status === 'rescheduled' ? 'lec lec-changed' : 'lec'
  return (
    <div className={cls}>
      <div className="lec-head">
        <strong className={status === 'cancelled' ? 'strike' : ''}>{lecture.subject}</strong>
        {lecture.batch && <span className="chip chip-warn" title="Practical batch">{lecture.batch}</span>}
        {lecture.kind && lecture.kind !== 'lecture' && <span className="chip">{lecture.kind}</span>}
        {status !== 'scheduled' && <StatusBadge status={status} />}
      </div>
      <div className="tt-cell-meta">
        {lecture.faculty}{effective.faculty !== lecture.faculty && status === 'rescheduled' ? ` → ${effective.faculty}` : ''}
        {showClass && ` · ${deptName(lecture.deptId)} · ${lecture.semester}${lecture.division ? ` · Division ${lecture.division}` : ''}`}
      </div>

      {status === 'scheduled' && (
        <div className="tt-cell-meta">{showDate && `${formatDay(entry.viewDate)} · `}{formatRange(effective.start, effective.end)} · {where(effective, lecture)}</div>
      )}

      {status === 'rescheduled' && (
        <div className="lec-compare">
          <div className="tt-cell-meta strike">Original: {formatDay(original.date)} · {formatRange(original.start, original.end)} · {where(original, lecture)}</div>
          {movedOut
            ? <div className="lec-new">Moved to {formatDay(effective.date)} · {formatRange(effective.start, effective.end)} · {where(effective, lecture)}</div>
            : <div className="lec-new">Updated: {movedIn ? `${formatDay(effective.date)} · ` : ''}{formatRange(effective.start, effective.end)} · {where(effective, lecture)}</div>}
          <div className="chip-row">{changes.filter(c => ['Date', 'Time', 'Room', 'Building', 'Faculty'].includes(c.field)).map(c => <span key={c.field} className="chip chip-warn">{c.field} changed</span>)}</div>
        </div>
      )}

      {status === 'cancelled' && (
        <div className="tt-cell-meta strike">{formatRange(original.start, original.end)} · {where(original, lecture)}</div>
      )}
      {exception?.reason && status !== 'scheduled' && <div className="tt-cell-meta">Reason: {exception.reason}</div>}
      {actions && <div className="lec-actions">{actions}</div>}
    </div>
  )
}
