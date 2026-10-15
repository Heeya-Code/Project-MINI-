import { formatDay, todayISO, weekdayOf } from '../utils/dates'
import { timeSlots } from '../data/timetable'
import { formatRange } from '../utils/dates'
import LectureEntry from './LectureEntry'

// Where a lecture sits in the grid: moved-out lectures stay in their ORIGINAL slot
// (so students see what changed); everything else sits at its effective start time.
const startOf = e => (e.movedOut ? e.original.start : e.effective.start)
const endOf = e => (e.movedOut ? e.original.end : e.effective.end)

// Weekly grid. `entriesByDate` = { 'YYYY-MM-DD': [entries] } for the 5 shown dates.
export default function Timetable({ dates, entriesByDate, showClass = false, renderActions = null, emptyText = 'No lectures match these filters.' }) {
  const today = todayISO()
  const all = dates.flatMap(d => entriesByDate[d] || [])
  // the college's standard slots, plus one row per other start time that actually occurs (official sheets)
  const rowMap = new Map(timeSlots.map(s => [s.start, { id: s.start, label: formatRange(s.start, s.end) }]))
  for (const e of all) if (!rowMap.has(startOf(e))) rowMap.set(startOf(e), { id: startOf(e), label: formatRange(startOf(e), endOf(e)) })
  const rows = [...rowMap.values()].sort((a, b) => a.id.localeCompare(b.id))
  if (!all.length) return <div className="empty-state"><div className="glyph">{'\u25A6'}</div>{emptyText}</div>
  return (
    <div className="tt-table-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Time</th>
            {dates.map(d => <th key={d} className={d === today ? 'tt-today' : ''}>{weekdayOf(d)}<div className="tt-cell-meta" style={{ fontWeight: 400 }}>{formatDay(d)}</div></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td className="tt-time">{row.label}</td>
              {dates.map(d => {
                const cell = (entriesByDate[d] || []).filter(e => startOf(e) === row.id)
                return (
                  <td key={d} className={d === today ? 'tt-today' : ''}>
                    {cell.length === 0 ? <span className="tt-empty">—</span> : cell.map(e => (
                      <LectureEntry key={e.key} entry={e} showClass={showClass} actions={renderActions?.(e)} />
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
