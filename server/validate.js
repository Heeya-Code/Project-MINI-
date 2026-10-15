// Timetable validation. Returns WARNINGS only — it never changes or rejects the data.
// Parallel practical batches (different batch codes, or electives) are legitimate and are not flagged.
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const KINDS = ['lecture', 'lab', 'tutorial', 'elective', 'other', 'break']
const toMin = t => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const overlaps = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)
const desc = e => `${e.subject}${e.batch ? ' ' + e.batch : ''}${e.faculty ? ' (' + e.faculty + ')' : ''} ${e.start}–${e.end}`

// Structural validation used before saving entries (hard errors).
export function entryErrors(e) {
  const errs = []
  if (!DAYS.includes(e.day)) errs.push('invalid day')
  if (toMin(e.start) === null || toMin(e.end) === null) errs.push('start/end must be HH:MM')
  else if (toMin(e.start) >= toMin(e.end)) errs.push('end must be after start')
  if (!String(e.subject || '').trim()) errs.push('subject is required')
  if (!KINDS.includes(e.kind || 'lecture')) errs.push('invalid kind')
  for (const k of ['subject', 'faculty', 'room', 'batch', 'label', 'note']) if (String(e[k] || '').length > 200) errs.push(`${k} is too long`)
  return errs
}

export function findWarnings(allEntries, legend = {}) {
  const entries = allEntries.filter(e => e.kind !== 'break') // tea/lunch breaks are shown on the sheet but are never sessions
  const out = []
  const w = (type, severity, message, idx) => out.push({ type, severity, message, entries: idx })
  const list = entries.map((e, i) => ({ ...e, i }))
  for (const day of DAYS) {
    const d = list.filter(e => e.day === day)
    for (let x = 0; x < d.length; x++) for (let y = x + 1; y < d.length; y++) {
      const a = d[x], b = d[y]
      if (!overlaps(a, b)) continue
      if (a.kind === 'elective' && b.kind === 'elective') continue // elective options run in parallel
      const sameBatch = a.batch && a.batch === b.batch
      const wholeClassVsAny = !a.batch || !b.batch // one of them involves the entire division
      if (sameBatch) w('batch_overlap', 'warning', `${day}: batch ${a.batch} has two sessions at the same time — ${desc(a)} and ${desc(b)}.`, [a.i, b.i])
      else if (wholeClassVsAny && !(a.kind === 'elective' || b.kind === 'elective')) w('division_overlap', 'warning', `${day}: ${desc(a)} overlaps ${desc(b)} for the whole division.`, [a.i, b.i])
      else if (wholeClassVsAny) w('division_overlap', 'warning', `${day}: elective ${desc(a.kind === 'elective' ? a : b)} overlaps ${desc(a.kind === 'elective' ? b : a)}.`, [a.i, b.i])
      if (a.faculty && a.faculty === b.faculty && !(a.subject === b.subject && a.room === b.room)) {
        w('faculty_overlap', 'warning', `${day}: faculty ${a.faculty} is scheduled twice at the same time — ${desc(a)} and ${desc(b)}.`, [a.i, b.i])
      }
    }
  }
  const facLegend = legend.faculty || {}, subLegend = legend.subjects || {}
  list.filter(e => !e.faculty && e.kind !== 'tutorial' && e.kind !== 'other').forEach(e => w('missing_faculty', 'info', `${e.day}: no faculty is shown for ${desc(e)}.`, [e.i]))
  const unknownFac = [...new Set(list.flatMap(e => String(e.faculty || '').split('/').map(f => f.trim())).filter(f => f && !facLegend[f]))]
  if (unknownFac.length) w('unknown_faculty_code', 'info', `Faculty code(s) not in this sheet's legend: ${unknownFac.join(', ')}.`, [])
  const unknownSub = [...new Set(list.filter(e => e.kind !== 'other').map(e => e.subject).filter(s => s && !subLegend[s] && !subLegend[s.replace(/ (LAB|Lab)$/, '')]))]
  if (unknownSub.length) w('unknown_subject_code', 'info', `Subject code(s) not in this sheet's legend: ${unknownSub.join(', ')}.`, [])
  return out
}
