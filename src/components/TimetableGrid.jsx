import { useMemo } from 'react'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const fmt12 = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
const KIND_LABEL = { lecture: 'Lecture', lab: 'Lab / practical', tutorial: 'Tutorial', elective: 'Elective', other: 'Other', break: 'Break' }

// Groups entries that run at the same time (parallel lab batches, parallel electives) into one block.
function blocksFor(entries) {
  const byKey = new Map()
  entries.forEach(e => { const k = `${e.start}-${e.end}`; if (!byKey.has(k)) byKey.set(k, { start: e.start, end: e.end, items: [] }); byKey.get(k).items.push(e) })
  return [...byKey.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

// Responsive weekly grid: 5 columns on wide screens, stacked days on tablets/phones.
export default function TimetableGrid({ entries, legend = {}, sheet = {} }) {
  const days = useMemo(() => DAY_ORDER.map(d => ({ day: d, blocks: blocksFor(entries.filter(e => e.day === d)) })).filter(d => d.blocks.length), [entries])
  const subjectName = s => legend.subjects?.[s] || legend.subjects?.[s.replace(/ (LAB|Lab)$/, '')] || ''
  const facName = f => String(f || '').split('/').map(c => c.trim()).filter(Boolean).map(c => legend.faculty?.[c] || '').filter(Boolean).join(' / ')
  if (!entries.length) return <div className="empty-state"><div className="glyph">{'\uD83D\uDDD3\uFE0F'}</div>This timetable has no structured entries. Use the original PDF.</div>
  return (
    <div className="ott">
      {sheet.notes?.length > 0 && <div className="ott-note" role="note">{sheet.notes.map(n => <div key={n}>{'\u2139\uFE0F'} {n}</div>)}</div>}
      <div className="ott-grid">
        {days.map(({ day, blocks }) => (
          <section key={day} className="ott-day" aria-label={day}>
            <h4 className="ott-day-name">{day}</h4>
            {blocks.map(b => {
              const label = b.items.find(i => i.label)?.label
              return (
                <div key={b.start + b.end} className={`ott-block ${b.items.length > 1 ? 'parallel' : ''}`}>
                  <div className="ott-time">{fmt12(b.start)} – {fmt12(b.end)}{label ? <span className="ott-printed"> {label}</span> : null}</div>
                  {b.items.length > 1 && <div className="ott-parallel-note">{b.items.every(i => i.kind === 'elective') ? 'Electives — one per student' : 'Parallel batches'}</div>}
                  {b.items.map((e, i) => (
                    <div key={i} className={`ott-item kind-${e.kind}`}>
                      <div className="ott-subject" title={subjectName(e.subject)}>
                        {e.subject}{e.batch && <span className="chip chip-warn ott-batch">{e.batch}</span>}
                        {e.kind !== 'lecture' && <span className="ott-kind">{KIND_LABEL[e.kind] || e.kind}</span>}
                      </div>
                      {subjectName(e.subject) && <div className="ott-sub">{subjectName(e.subject)}</div>}
                      <div className="ott-meta">
                        {e.faculty ? <span title={facName(e.faculty)}>{e.faculty}{facName(e.faculty) ? ` · ${facName(e.faculty)}` : ''}</span> : <span className="muted-text">Faculty not shown</span>}
                        {e.room && <span> · Room {e.room}</span>}
                      </div>
                      {e.note && <div className="ott-sub">{e.note}</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </section>
        ))}
      </div>
      <details className="ott-legend">
        <summary>Subjects and faculty (as printed on the sheet)</summary>
        <div className="ott-legend-cols">
          <div><strong>Subjects</strong>{Object.entries(legend.subjects || {}).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</div>
          <div><strong>Faculty</strong>{Object.entries(legend.faculty || {}).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</div>
        </div>
      </details>
    </div>
  )
}
