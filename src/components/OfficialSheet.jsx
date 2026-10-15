import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TimetableGrid from './TimetableGrid'
import { departments, hasDivisions } from '../data/departments'
import { api, fileUrl } from '../api/client'

const fmtDate = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
const fmtStamp = s => s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

// The OFFICIAL published timetable of one class as printed (grid + original PDF). Only published, currently
// applicable versions are ever returned by the server; drafts, withdrawn, expired and future ones are not.
// Approved one-day changes and cancellations are shown on the Weekly schedule tab.
export default function OfficialSheet({ dept, sem, div, isAdmin = false }) {
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState('grid')
  // a department without divisions (EXTC, Chemistry) needs only department + semester
  const ready = dept && dept !== 'all' && sem && sem !== 'all' && (!hasDivisions(dept) || (div && div !== 'all'))

  useEffect(() => {
    if (!ready) { setRes(null); setError(null); return undefined }
    let cancelled = false
    setLoading(true); setError(null)
    api(`/published?dept=${dept}&semester=${encodeURIComponent(sem)}${hasDivisions(dept) ? `&division=${encodeURIComponent(div)}` : ''}`)
      .then(r => { if (!cancelled) setRes(r) })
      .catch(e => { if (!cancelled) { setError(e); setRes(null) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dept, sem, div, ready, attempt])

  const t = res?.state === 'published' ? res.timetable : null
  if (!ready) return <div className="empty-state"><div className="glyph">{'\uD83D\uDDD3\uFE0F'}</div>{hasDivisions(dept) || !dept || dept === 'all' ? 'Select a department, semester and division to see the official timetable.' : 'Select a semester to see the official timetable.'}</div>
  if (loading) return <div className="empty-state" role="status" aria-live="polite">Loading timetable…</div>
  if (error) return (
    <div className="empty-state" role="alert">
      <div className="glyph">{'\u26A0\uFE0F'}</div>
      {error.status === 401 ? 'Your session has ended. Please log in again.' : error.message}
      <div style={{ marginTop: 12 }}><button className="btn btn-outline btn-sm" onClick={() => setAttempt(a => a + 1)}>Try again</button></div>
    </div>
  )
  if (res && res.state !== 'published') return (
    <div className="empty-state" role="status">
      <div className="glyph">{res.state === 'withdrawn' ? '\u26D4' : '\uD83D\uDCED'}</div>
      <h3>{res.state === 'withdrawn' ? 'Timetable withdrawn' : res.state === 'upcoming' ? 'Timetable not yet in effect' : res.state === 'expired' ? 'Timetable expired' : 'No official timetable published yet'}</h3>
      {res.message}
    </div>
  )
  if (!t) return null
  return (
    <>
      <div className="ott-head">
        <div>
          <h3 style={{ margin: 0 }}>{departments.find(d => d.id === t.dept_id)?.name} · {t.semester}{t.division ? ` · Division ${t.division}` : ''}</h3>
          <div className="chip-row">
            <span className="chip">Academic year {t.academic_year}</span>
            <span className="chip">Effective {fmtDate(t.effective_from)}</span>
            {t.expires_on && <span className="chip">Valid until {fmtDate(t.expires_on)}</span>}
            <span className="chip">Updated {fmtStamp(t.updated_at)}</span>
            {t.sheet?.room && <span className="chip">Room {t.sheet.room}</span>}
            <span className="chip chip-good">Published</span>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          {t.has_file && <a className="btn btn-outline btn-sm" href={fileUrl(t.id)} target="_blank" rel="noreferrer">View PDF</a>}
          {t.has_file && <a className="btn btn-primary btn-sm" href={fileUrl(t.id, true)}>Download PDF</a>}
          {isAdmin && <Link className="btn btn-outline btn-sm" to="/app/timetable-uploads">Versions & history</Link>}
        </div>
      </div>
      <p className="muted-text" style={{ marginTop: 0 }}>This is the official sheet as published. Approved one-day changes and cancellations appear on the <strong>Weekly schedule</strong> tab.</p>
      <div className="tabs" role="tablist" aria-label="Official sheet view">
        {[['grid', 'Sheet'], ...(t.has_file ? [['pdf', 'Original PDF']] : [])].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} className={`tab ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      {view === 'grid' || !t.has_file
        ? <TimetableGrid entries={t.entries} legend={t.legend} sheet={t.sheet} />
        : <iframe className="ott-pdf" title="Original timetable PDF" src={fileUrl(t.id)} />}
    </>
  )
}
