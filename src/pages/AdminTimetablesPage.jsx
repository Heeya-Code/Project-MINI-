import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import DashboardCard from '../components/DashboardCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import TimetableGrid from '../components/TimetableGrid'
import { departments, semesters, divisionOptionsFor, hasDivisions } from '../data/departments'
import { api, upload, fileUrl, ApiError } from '../api/client'

const MAX_MB = 10
const STATUS_CHIP = { draft: 'chip-warn', published: 'chip-good', withdrawn: 'chip-bad', archived: '', cancelled: '' }
const deptShort = id => departments.find(d => d.id === id)?.short || id
const fmtStamp = s => s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
const defaultYear = () => { const n = new Date(); const y = n.getMonth() >= 5 ? n.getFullYear() : n.getFullYear() - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}` }
const StatusChip = ({ status }) => <span className={`chip ${STATUS_CHIP[status] || ''}`}>{status}</span>
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const KINDS = ['lecture', 'lab', 'tutorial', 'elective', 'other', 'break']
const blankRow = () => ({ day: 'Monday', start: '09:30', end: '10:30', kind: 'lecture', subject: '', faculty: '', room: '', batch: '', label: '', note: '' })

function Warnings({ warnings }) {
  if (!warnings?.length) return <p className="muted-text">No conflicts or gaps detected.</p>
  return (
    <ul className="ott-warnings" aria-label="Validation warnings">
      {warnings.map((w, i) => <li key={i} className={w.severity === 'warning' ? 'w-warn' : 'w-info'}><strong>{w.severity === 'warning' ? 'Warning' : 'Note'}:</strong> {w.message}</li>)}
    </ul>
  )
}

// ------------------------------------------------------------------ upload form
function UploadModal({ onClose, onDone, presets = {} }) {
  const toast = useToast()
  const [f, setF] = useState({ dept_id: presets.dept_id || 'it', semester: presets.semester || 'SEM III', division: '', academic_year: defaultYear(), effective_from: '', expires_on: '', title: '', notes: '', status: 'draft' })
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [dupe, setDupe] = useState(false)
  const [replaceFor, setReplaceFor] = useState(null)
  const options = divisionOptionsFor(f.dept_id, f.semester)
  const division = options.includes(f.division) ? f.division : ''
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  function pick(e) {
    const picked = e.target.files?.[0]
    setError(''); setDupe(false)
    if (!picked) return setFile(null)
    if (!/\.pdf$/i.test(picked.name) || (picked.type && picked.type !== 'application/pdf')) { setFile(null); return setError('Only PDF files can be uploaded.') }
    if (picked.size > MAX_MB * 1048576) { setFile(null); return setError(`The file is larger than ${MAX_MB} MB.`) }
    setFile(picked)
  }
  async function submit(extra = {}) {
    setError('')
    if (hasDivisions(f.dept_id) && !division) return setError('Choose a division.')
    if (!file) return setError('Choose a PDF file.')
    if (!f.effective_from) return setError('Choose the effective date.')
    if (f.expires_on && f.expires_on < f.effective_from) return setError('The expiry date cannot be before the effective date.')
    const fd = new FormData()
    Object.entries({ ...f, division, ...extra }).forEach(([k, v]) => v !== '' && fd.append(k, v))
    fd.append('file', file)
    setProgress(0)
    try {
      const out = await upload('/admin/versions', fd, setProgress)
      toast('success', out.version?.status === 'published' || out.version?.status === undefined ? 'Timetable uploaded and published.' : 'Timetable saved as a draft. Open it to preview and publish.')
      onDone(out.id)
    } catch (e) {
      setProgress(null)
      if (e.code === 'DUPLICATE_FILE') setDupe(true)
      if (e.code === 'REPLACE_REQUIRED' && e.extra?.draft_id) { setReplaceFor(e.extra.draft_id); return }
      setError(e.message)
    }
  }
  const busy = progress !== null

  return (
    <Modal title="Upload timetable" onClose={busy ? () => {} : onClose} wide>
      <div className="form-grid">
        <div className="field"><label htmlFor="up-dept">Department</label>
          <select id="up-dept" value={f.dept_id} onChange={e => set('dept_id', e.target.value)}>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="field"><label htmlFor="up-year">Academic year</label>
          <input id="up-year" value={f.academic_year} onChange={e => set('academic_year', e.target.value)} placeholder="2026-27" /></div>
        <div className="field"><label htmlFor="up-sem">Semester</label>
          <select id="up-sem" value={f.semester} onChange={e => set('semester', e.target.value)}>{semesters.map(s => <option key={s}>{s}</option>)}</select></div>
        {hasDivisions(f.dept_id) && (<div className="field"><label htmlFor="up-div">Division</label>
          <select id="up-div" value={division} onChange={e => set('division', e.target.value)}><option value="">Select division</option>{options.map(d => <option key={d} value={d}>{d}</option>)}</select></div>)}
        <div className="field"><label htmlFor="up-eff">Effective date</label>
          <input id="up-eff" type="date" value={f.effective_from} onChange={e => set('effective_from', e.target.value)} /></div>
        <div className="field"><label htmlFor="up-exp">Expiry date (optional)</label>
          <input id="up-exp" type="date" value={f.expires_on} onChange={e => set('expires_on', e.target.value)} /></div>
        <div className="field"><label htmlFor="up-title">Title / version note (optional)</label>
          <input id="up-title" value={f.title} onChange={e => set('title', e.target.value)} maxLength={200} /></div>
        <div className="field"><label htmlFor="up-status">Status</label>
          <select id="up-status" value={f.status} onChange={e => set('status', e.target.value)}><option value="draft">Draft (preview first)</option><option value="published">Publish immediately</option></select></div>
        <div className="field field-full"><label htmlFor="up-notes">Notes (optional)</label>
          <textarea id="up-notes" rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} maxLength={2000} /></div>
        <div className="field field-full"><label htmlFor="up-file">Timetable PDF (max {MAX_MB} MB)</label>
          <input id="up-file" type="file" accept="application/pdf,.pdf" onChange={pick} />
          {file && <span className="muted-text">{file.name} · {(file.size / 1048576).toFixed(2)} MB</span>}</div>
      </div>
      {f.status === 'published' && <p className="muted-text">Publishing immediately makes this visible to students and notifies the class. Choose “Draft” if you want to preview it first.</p>}
      {progress !== null && <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="ott-progress"><div style={{ width: `${progress}%` }} /></div>}
      {error && <div className="ott-error" role="alert">{error}</div>}
      <div className="btn-row">
        {dupe && <button className="btn btn-outline" onClick={() => submit({ allow_duplicate: '1' })}>Upload anyway</button>}
        <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={() => submit()} disabled={busy}>{busy ? `Uploading… ${progress}%` : f.status === 'published' ? 'Upload & publish' : 'Upload as draft'}</button>
      </div>
      {replaceFor && (
        <ConfirmDialog title="Replace the published timetable?" danger requireReason reasonLabel="Reason for replacing" confirmLabel="Replace and publish"
          message="This class already has a published timetable. Your upload was saved as a draft. Replacing archives the current one, publishes this one, and notifies students."
          onClose={() => { setReplaceFor(null); onDone(replaceFor) }}
          onConfirm={async reason => { try { await api(`/admin/versions/${replaceFor}/publish`, { method: 'POST', body: { replace: true, reason } }); toast('success', 'Replaced and published.'); onDone(replaceFor) } catch (e) { toast('error', e.message); setReplaceFor(null); onDone(replaceFor) } }} />
      )}
    </Modal>
  )
}

// ------------------------------------------------------------------ version detail
function DetailModal({ id, onClose, onChanged, onOpen }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('details')
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({})
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await api(`/admin/versions/${id}`)
      setData(d); setRows(d.entries); setDirty(false)
      setMeta({ title: d.version.title, notes: d.version.notes, effective_from: d.version.effective_from || '', expires_on: d.version.expires_on || '' })
    } catch (e) { setError(e.message) }
  }, [id])
  useEffect(() => { setData(null); setError(''); load() }, [load])

  async function run(okMsg, fn) {
    setBusy(true)
    try { const out = await fn(); toast('success', okMsg); await load(); onChanged(); return out } catch (e) { toast('error', e.message); return null } finally { setBusy(false) }
  }
  if (error) return <Modal title="Timetable" onClose={onClose}><div className="ott-error" role="alert">{error}</div></Modal>
  if (!data) return <Modal title="Timetable" onClose={onClose}><div role="status">Loading…</div></Modal>

  const { version: v, timetable: t, warnings, history, audit } = data
  const isDraft = v.status === 'draft'
  const title = `${deptShort(t.dept_id)} ${t.semester}${t.division ? ` · Division ${t.division}` : ''} · ${t.academic_year} · v${v.version_no}`
  const setRow = (i, k, val) => { setRows(r => r.map((x, j) => j === i ? { ...x, [k]: val } : x)); setDirty(true) }

  async function publish() {
    setBusy(true)
    try {
      await api(`/admin/versions/${id}/publish`, { method: 'POST', body: {} })
      toast('success', 'Published. Students can see it now.'); await load(); onChanged()
    } catch (e) {
      if (e.code === 'REPLACE_REQUIRED') setConfirm({ kind: 'replace' }); else toast('error', e.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="chip-row" style={{ marginTop: 0 }}>
        <StatusChip status={v.status} />
        {v.has_file && <a className="chip chip-btn" href={fileUrl(v.id)} target="_blank" rel="noreferrer">Open PDF</a>}
        <span className="chip">Updated {fmtStamp(v.updated_at)}</span>
        {dirty && <span className="chip chip-warn">Unsaved changes</span>}
      </div>
      <div className="btn-row ott-actions" style={{ justifyContent: 'flex-start' }}>
        {isDraft && <button className="btn btn-brass btn-sm" disabled={busy || dirty} title={dirty ? 'Save your changes first' : ''} onClick={publish}>Publish</button>}
        {isDraft && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setConfirm({ kind: 'cancel' })}>Cancel this draft</button>}
        {v.status === 'published' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run('Editable draft created.', async () => { const out = await api(`/admin/versions/${id}/clone`, { method: 'POST', body: {} }); onOpen(out.version.id) })}>Create editable draft</button>}
        {v.status === 'published' && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setConfirm({ kind: 'withdraw' })}>Withdraw</button>}
        {['published', 'withdrawn'].includes(v.status) && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setConfirm({ kind: 'archive' })}>Archive</button>}
        {['withdrawn', 'archived', 'cancelled'].includes(v.status) && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run('Restored as a new draft.', async () => { const out = await api(`/admin/versions/${id}/clone`, { method: 'POST', body: { restore: true } }); onOpen(out.version.id) })}>Restore as new draft</button>}
      </div>
      <div className="tabs" role="tablist">
        {[['details', 'Details'], ['entries', 'Entries'], ['preview', 'Preview'], ['history', 'History & audit']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'details' && (
        <>
          {!isDraft && <p className="muted-text">Only drafts can be edited. {v.status === 'published' ? 'Use “Create editable draft” to prepare a revision; students keep seeing this version until you publish the draft.' : 'Use “Restore as new draft” to bring it back.'}</p>}
          <div className="form-grid">
            <div className="field"><label htmlFor="d-eff">Effective date</label><input id="d-eff" type="date" disabled={!isDraft} value={meta.effective_from} onChange={e => setMeta(m => ({ ...m, effective_from: e.target.value }))} /></div>
            <div className="field"><label htmlFor="d-exp">Expiry date</label><input id="d-exp" type="date" disabled={!isDraft} value={meta.expires_on} onChange={e => setMeta(m => ({ ...m, expires_on: e.target.value }))} /></div>
            <div className="field field-full"><label htmlFor="d-title">Title / version note</label><input id="d-title" disabled={!isDraft} value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} /></div>
            <div className="field field-full"><label htmlFor="d-notes">Notes</label><textarea id="d-notes" rows={2} disabled={!isDraft} value={meta.notes} onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))} /></div>
          </div>
          {isDraft && (
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>Replace PDF
                <input type="file" accept="application/pdf,.pdf" hidden onChange={e => {
                  const file = e.target.files?.[0]; e.target.value = ''
                  if (!file) return
                  if (!/\.pdf$/i.test(file.name) || file.size > MAX_MB * 1048576) return toast('error', `Choose a PDF up to ${MAX_MB} MB.`)
                  const fd = new FormData(); fd.append('file', file)
                  run('PDF replaced.', () => upload(`/admin/versions/${id}/file`, fd))
                }} /></label>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run('Details saved.', () => api(`/admin/versions/${id}`, { method: 'PUT', body: meta }))}>Save details</button>
            </div>
          )}
          {v.sheet?.sourceIssues?.length > 0 && (
            <div className="ott-note" role="note"><strong>Please review — problems on the source sheet</strong> (kept exactly as printed, not corrected):
              <ul>{v.sheet.sourceIssues.map(s => <li key={s}>{s}</li>)}</ul></div>
          )}
          <h4>Validation</h4><Warnings warnings={warnings} />
        </>
      )}

      {tab === 'entries' && (
        <>
          {!isDraft && <p className="muted-text">This version is read-only. Create an editable draft to change entries.</p>}
          <div className="table-wrap">
            <table className="ott-edit">
              <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Type</th><th>Subject</th><th>Faculty</th><th>Room</th><th>Batch</th><th>Printed time</th><th /></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><select aria-label={`Day row ${i + 1}`} disabled={!isDraft} value={r.day} onChange={e => setRow(i, 'day', e.target.value)}>{DAYS.map(d => <option key={d}>{d}</option>)}</select></td>
                    <td><input type="time" aria-label={`Start row ${i + 1}`} disabled={!isDraft} value={r.start} onChange={e => setRow(i, 'start', e.target.value)} /></td>
                    <td><input type="time" aria-label={`End row ${i + 1}`} disabled={!isDraft} value={r.end} onChange={e => setRow(i, 'end', e.target.value)} /></td>
                    <td><select aria-label={`Type row ${i + 1}`} disabled={!isDraft} value={r.kind} onChange={e => setRow(i, 'kind', e.target.value)}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></td>
                    {['subject', 'faculty', 'room', 'batch', 'label'].map(k => <td key={k}><input aria-label={`${k} row ${i + 1}`} disabled={!isDraft} value={r[k]} onChange={e => setRow(i, k, e.target.value)} style={{ width: k === 'subject' ? 110 : 70 }} /></td>)}
                    <td>{isDraft && <button className="btn btn-outline btn-sm" aria-label={`Remove row ${i + 1}`} onClick={() => { setRows(rs => rs.filter((_, j) => j !== i)); setDirty(true) }}>{'\u2715'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="muted-text">No structured entries yet. Students will see the PDF only until you add entries.</p>}
          {isDraft && (
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setRows(r => [...r, blankRow()]); setDirty(true) }}>+ Add entry</button>
              <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => run('Entries saved.', () => api(`/admin/versions/${id}/entries`, { method: 'PUT', body: { entries: rows } }))}>Save entries</button>
            </div>
          )}
          <h4>Validation</h4><Warnings warnings={warnings} />
        </>
      )}

      {tab === 'preview' && (
        <>
          <p className="muted-text">{isDraft ? 'This is how students will see the timetable once published (unsaved edits are included).' : 'Student view of this version.'}</p>
          <TimetableGrid entries={rows} legend={v.legend} sheet={v.sheet} />
        </>
      )}

      {tab === 'history' && (
        <>
          <h4>Versions</h4>
          <div className="table-wrap"><table className="ott-edit"><thead><tr><th>Version</th><th>Status</th><th>Effective</th><th>Created by</th><th>Updated</th><th /></tr></thead>
            <tbody>{history.map(h => (
              <tr key={h.id}><td>v{h.version_no}</td><td><StatusChip status={h.status} /></td><td>{h.effective_from || '—'}</td><td>{h.created_by}</td><td>{fmtStamp(h.updated_at)}</td>
                <td>{h.id !== id && <button className="btn btn-outline btn-sm" onClick={() => onOpen(h.id)}>View</button>}</td></tr>))}</tbody></table></div>
          <h4>Audit log</h4>
          <div className="table-wrap"><table className="ott-edit"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Change</th><th>Reason</th></tr></thead>
            <tbody>{audit.map(a => (
              <tr key={a.id}><td>{fmtStamp(a.at)}</td><td>{a.user_name}</td><td>{a.action.replace('_', ' ')}</td>
                <td>{a.from_version || a.to_version ? `v${a.from_version ?? '–'} → v${a.to_version ?? '–'}` : ''}{a.from_status || a.to_status ? ` (${a.from_status || '–'} → ${a.to_status || '–'})` : ''}</td><td>{a.reason}</td></tr>))}</tbody></table></div>
        </>
      )}

      {confirm?.kind === 'withdraw' && <ConfirmDialog title="Withdraw this timetable?" danger requireReason reasonLabel="Reason (shown to students)" confirmLabel="Withdraw" message="Students will stop seeing this timetable and will be notified. It is kept in history and can be restored." onClose={() => setConfirm(null)} onConfirm={reason => { setConfirm(null); run('Timetable withdrawn.', () => api(`/admin/versions/${id}/withdraw`, { method: 'POST', body: { reason } })) }} />}
      {confirm?.kind === 'archive' && <ConfirmDialog title="Archive this timetable?" danger requireReason confirmLabel="Archive" message="Archived timetables are hidden from students and kept for history." onClose={() => setConfirm(null)} onConfirm={reason => { setConfirm(null); run('Timetable archived.', () => api(`/admin/versions/${id}/archive`, { method: 'POST', body: { reason } })) }} />}
      {confirm?.kind === 'cancel' && <ConfirmDialog title="Cancel this pending update?" danger confirmLabel="Cancel draft" message="The draft will be marked cancelled (it is kept in history). The published timetable is not affected." onClose={() => setConfirm(null)} onConfirm={() => { setConfirm(null); run('Draft cancelled.', () => api(`/admin/versions/${id}/cancel`, { method: 'POST', body: {} })) }} />}
      {confirm?.kind === 'replace' && <ConfirmDialog title="Replace the published timetable?" danger requireReason reasonLabel="Reason for replacing" confirmLabel="Replace and publish" message="This class already has a published timetable. Replacing archives it, publishes this version and notifies students." onClose={() => setConfirm(null)} onConfirm={reason => { setConfirm(null); run('Replaced and published.', () => api(`/admin/versions/${id}/publish`, { method: 'POST', body: { replace: true, reason } })) }} />}
    </Modal>
  )
}

// ------------------------------------------------------------------ page
export default function AdminTimetablesPage() {
  const { logout } = useAuth()
  const [dept, setDept] = useState('')
  const [sem, setSem] = useState('')
  const [div, setDiv] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [uploading, setUploading] = useState(false)

  const divisions = dept && sem ? divisionOptionsFor(dept, sem) : []
  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (dept) p.set('dept', dept); if (sem) p.set('semester', sem); if (div) p.set('division', div); if (status) p.set('status', status)
    return p.toString()
  }, [dept, sem, div, status])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setRows((await api(`/admin/timetables${query ? '?' + query : ''}`)).versions) } catch (e) { setError(e instanceof ApiError ? e : new ApiError(0, 'X', String(e))) } finally { setLoading(false) }
  }, [query])
  useEffect(() => { load() }, [load])

  return (
    <DashboardCard title="Timetable Uploads" action={<button className="btn btn-primary btn-sm" onClick={() => setUploading(true)}>Upload timetable</button>}>
      <p className="muted-text" style={{ marginTop: 0 }}>Upload, preview, publish, replace and withdraw official timetables for any department, semester and division. Every change is versioned and logged.</p>
      <div className="filter-bar">
        <select aria-label="Filter department" value={dept} onChange={e => { setDept(e.target.value); setDiv('') }}><option value="">All departments</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select aria-label="Filter semester" value={sem} onChange={e => { setSem(e.target.value); setDiv('') }}><option value="">All semesters</option>{semesters.map(s => <option key={s}>{s}</option>)}</select>
        {(!dept || hasDivisions(dept)) && <select aria-label="Filter division" value={div} onChange={e => setDiv(e.target.value)} disabled={!dept || !sem}><option value="">All divisions</option>{divisions.map(d => <option key={d}>{d}</option>)}</select>}
        <select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['draft', 'published', 'withdrawn', 'archived', 'cancelled'].map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {loading && <div className="empty-state" role="status">Loading…</div>}
      {error && <div className="empty-state" role="alert"><div className="glyph">{'\u26A0\uFE0F'}</div>{error.status === 401 ? 'Your server session has ended.' : error.status === 403 ? 'Your account is not authorised for timetable administration.' : error.message}
          {[401, 403].includes(error.status) && <div className="muted-text" style={{ marginTop: 6 }}>Sign in with an administrator account.</div>}
          <div className="btn-row" style={{ justifyContent: 'center' }}>{[401, 403].includes(error.status) && <button className="btn btn-primary btn-sm" onClick={logout}>Log out and sign in again</button>}<button className="btn btn-outline btn-sm" onClick={load}>Try again</button></div></div>}
      {!loading && !error && rows.length === 0 && <div className="empty-state"><div className="glyph">{'\uD83D\uDCED'}</div>No timetables match these filters.</div>}
      {!loading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table className="ott-edit">
            <thead><tr><th>Department</th><th>Semester</th><th>Div</th><th>Year</th><th>Ver.</th><th>Status</th><th>Effective</th><th>Updated</th><th>Entries</th><th /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}><td>{deptShort(r.dept_id)}</td><td>{r.semester}</td><td>{r.division || '—'}</td><td>{r.academic_year}</td><td>v{r.version_no}</td><td><StatusChip status={r.status} /></td><td>{r.effective_from || '—'}</td><td>{fmtStamp(r.updated_at)}</td><td>{r.entry_count}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => setOpenId(r.id)}>Open</button></td></tr>))}</tbody>
          </table>
        </div>
      )}
      {uploading && <UploadModal presets={{ dept_id: dept || undefined, semester: sem || undefined }} onClose={() => setUploading(false)} onDone={id => { setUploading(false); load(); if (id) setOpenId(id) }} />}
      {openId && <DetailModal key={openId} id={openId} onClose={() => setOpenId(null)} onChanged={load} onOpen={setOpenId} />}
    </DashboardCard>
  )
}
