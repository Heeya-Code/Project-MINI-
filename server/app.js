import express from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { defaults } from './config.js'
import { openDb, tx } from './db.js'
import { COOKIE, createSession, destroySession, parseCookies, userForToken, verifyPassword, hashPassword } from './auth.js'
import { DAYS, entryErrors, findWarnings } from './validate.js'
import { DEPARTMENTS, SEMESTERS, divisionOptionsFor, hasDivisions, isValidClass } from '../shared/divisions.js'

// Human-readable reason why a (department, semester, division) is not an active class
const classError = (dept, sem, div) => !SEMESTERS.includes(sem) ? `${sem || 'That semester'} is not an active semester (only ${SEMESTERS.join(', ')}).`
  : hasDivisions(dept) ? `"${div}" is not a valid division for ${dept.toUpperCase()} ${sem}.` : `${dept.toUpperCase()} has one class per semester and no divisions; leave the division empty.`
import { HttpError, changeStatus, classLabel, cloneVersion, contentHash, getEntries, listMeta, publicVersion, publishVersion, setEntries, warningsFor, writeAudit } from './timetables.js'
import { DEMO_USERS, seedOfficialTimetables, seedUsers } from './seed.js'
import { ACTION_NAMES, currentRev, ensureState, importBrowserState, pushNotice, reconcile, runAction, stateFor, mutate, syncOfficialLectures } from './state.js'
import { buildSeedState } from '../src/store/seed.js'
import { retireInactiveClasses } from './retire.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const validDate = s => ISO.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s)
const validYear = s => { const m = /^(\d{4})-(\d{2})$/.exec(s || ''); return !!m && (Number(m[1]) + 1) % 100 === Number(m[2]) }
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function createApp(opts = {}) {
  const cfg = { ...defaults, ...opts }
  const db = opts.db || openDb(cfg.dataDir)
  const nowIso = opts.now || (() => new Date().toISOString())
  const todayStr = opts.today || (() => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timeZone }).format(new Date()))
  const filesDir = path.join(cfg.dataDir, 'files')
  fs.mkdirSync(filesDir, { recursive: true })
  if (opts.seed !== false) {
    seedUsers(db, { demo: cfg.seedDemoUsers }); seedOfficialTimetables(db, cfg.dataDir, nowIso, { skip: opts.skipOfficial || [] })
    retireInactiveClasses(db, nowIso())
    ensureState(db, todayStr(), nowIso())
    reconcile(db, todayStr(), nowIso())
  }
  // After ANY official-timetable change: mirror it into the shared lectures and deliver its notice (once).
  const afterOfficial = out => {
    try { syncOfficialLectures(db, todayStr(), nowIso()); if (out?.notice) pushNotice(db, out.notice, nowIso()) } catch (e) { console.error('official sync failed (will retry at next start):', e) }
    if (out) { const { notice: _n, ...rest } = out; return rest }
    return out
  }

  const app = express()
  app.disable('x-powered-by')
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1) // behind a TLS-terminating proxy (Render, Railway, nginx …)
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next() })
  app.use(express.json({ limit: '1mb' }))

  // ---- session + CSRF ----
  app.use('/api', (req, _res, next) => {
    req.token = parseCookies(req.headers.cookie)[COOKIE]
    req.user = userForToken(db, req.token)
    next()
  })
  app.use('/api', (req, _res, next) => {
    // Cookies are SameSite=Lax; this extra header can only be set by our own JS (cross-site forms can't send it).
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'tsec-sync') return next(new HttpError(403, 'CSRF', 'Missing X-Requested-With header.'))
    next()
  })
  const requireUser = (req, _res, next) => req.user ? next() : next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'))
  const requireAdmin = (req, _res, next) => !req.user ? next(new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.')) : req.user.role !== 'management' ? next(new HttpError(403, 'FORBIDDEN', 'Administrator access is required.')) : next()

  // Liveness probe for hosting platforms: public, reveals nothing but "the process and the database answer".
  app.get('/api/health', (_req, res) => { try { db.prepare('SELECT 1').get(); res.json({ ok: true }) } catch { res.status(503).json({ ok: false }) } })

  // ---- auth ----
  const failures = new Map() // naive login throttle: key -> {n, until}
  const DUMMY = hashPassword('not-a-real-password')
  app.post('/api/login', wrap((req, res) => {
    const { email = '', password = '', role = '' } = req.body || {}
    const key = `${req.ip}|${String(email).toLowerCase()}`
    const f = failures.get(key)
    if (f && f.n >= 8 && f.until > Date.now()) throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts. Try again in a few minutes.')
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim())
    const ok = verifyPassword(String(password), row ? row.password_hash : DUMMY) && row && (!role || row.role === role)
    if (!ok) {
      failures.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60 * 1000 })
      destroySession(db, req.token); res.clearCookie(COOKIE, { path: '/' }) // never leave an older account's session behind
      throw new HttpError(401, 'BAD_CREDENTIALS', 'Invalid email, password or role.')
    }
    failures.delete(key)
    const token = createSession(db, row.id, cfg.sessionHours)
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: cfg.sessionHours * 3600 * 1000, path: '/' })
    const { password_hash: _p, ...user } = row
    res.json({ user })
  }))
  app.post('/api/logout', (req, res) => { destroySession(db, req.token); res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }) })
  app.get('/api/me', requireUser, (req, res) => res.json({ user: req.user }))
  // Demo logins are listed ONLY when demo users exist AND the server is not in production mode.
  const demoAccounts = cfg.seedDemoUsers && process.env.NODE_ENV !== 'production' ? DEMO_USERS.map(([email, password, role, name]) => ({ email, password, role, name })) : []
  app.get('/api/config', (_req, res) => res.json({
    demoAccounts, demoReset: process.env.ALLOW_DEMO_RESET === '1',
    departments: DEPARTMENTS, semesters: SEMESTERS, days: DAYS,
    divisions: Object.fromEntries(DEPARTMENTS.map(d => [d.id, Object.fromEntries(SEMESTERS.map(s => [s, divisionOptionsFor(d.id, s)]))])),
  }))

  // ---- student-facing: published, currently applicable timetables only ----
  const parseClass = q => {
    const dept = String(q.dept || ''), semester = String(q.semester || ''), division = String(q.division || '')
    if (!isValidClass(dept, semester, division)) throw new HttpError(400, 'INVALID_CLASS', classError(dept, semester, division))
    return { dept, semester, division }
  }
  const isCurrent = (v, today) => v.status === 'published' && v.effective_from <= today && (!v.expires_on || v.expires_on >= today)

  app.get('/api/published', requireUser, wrap((req, res) => {
    const { dept, semester, division } = parseClass(req.query)
    const today = todayStr()
    const rows = db.prepare(`SELECT v.*, t.academic_year, t.dept_id, t.semester, t.division FROM versions v JOIN timetables t ON t.id=v.timetable_id
      WHERE t.dept_id=? AND t.semester=? AND t.division=? AND v.status IN ('published','withdrawn') ORDER BY v.effective_from DESC, v.id DESC`).all(dept, semester, division)
    const cur = rows.find(v => isCurrent(v, today))
    if (cur) {
      const pv = publicVersion(cur)
      const { sheet: { sourceIssues: _hidden, ...sheet }, ...rest } = pv // source-sheet issues are for administrators
      return res.json({ state: 'published', timetable: { ...rest, sheet, dept_id: dept, semester, division, academic_year: cur.academic_year, entries: getEntries(db, cur.id) } })
    }
    const upcoming = rows.find(v => v.status === 'published' && v.effective_from > today)
    if (upcoming) return res.json({ state: 'upcoming', message: `A timetable for this class will take effect on ${upcoming.effective_from}.`, effective_from: upcoming.effective_from })
    const expired = rows.find(v => v.status === 'published')
    if (expired) return res.json({ state: 'expired', message: 'The last published timetable for this class has expired and no replacement has been published yet.' })
    const withdrawn = rows.find(v => v.status === 'withdrawn')
    if (withdrawn) return res.json({ state: 'withdrawn', message: 'The timetable for this class has been withdrawn and no replacement has been published yet. Please check with your department.', withdrawn_on: withdrawn.updated_at })
    res.json({ state: 'none', message: 'No timetable has been published for this class yet.' })
  }))

  app.get('/api/files/:id', requireUser, wrap((req, res) => {
    const v = db.prepare('SELECT v.*, t.dept_id, t.semester, t.division FROM versions v JOIN timetables t ON t.id=v.timetable_id WHERE v.id=?').get(Number(req.params.id))
    const isAdmin = req.user.role === 'management'
    if (!v || !v.file_key || (!isAdmin && !isCurrent(v, todayStr()))) throw new HttpError(404, 'NOT_FOUND', 'File not available.')
    const full = path.join(filesDir, path.basename(v.file_key))
    if (!fs.existsSync(full)) throw new HttpError(404, 'FILE_MISSING', 'The stored file is missing. Please contact an administrator.')
    const safe = String(v.file_name || 'timetable.pdf').replace(/[^\w.\- ]+/g, '_')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${safe}"`)
    res.setHeader('Cache-Control', 'private, no-cache')
    fs.createReadStream(full).pipe(res)
  }))

  // ---- shared application state (server-authoritative) ----
  // GET /api/state            -> everything THIS user may see
  // GET /api/state?rev=N      -> { unchanged: true } when nothing changed (cheap polling)
  app.get('/api/state', requireUser, (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const rev = currentRev(db)
    if (req.query.rev !== undefined && Number(req.query.rev) === rev) return res.json({ unchanged: true, rev })
    res.json({ state: stateFor(db, req.user), today: todayStr() })
  })
  // POST /api/actions/:name  { input, opId } — the actor is ALWAYS the session user, never anything the client claims.
  app.post('/api/actions/:name', requireUser, (req, res) => {
    const out = runAction(db, req.user, req.params.name, req.body?.input ?? {}, { today: todayStr(), now: nowIso(), opId: req.body?.opId })
    if (out.error) return res.status(out.status).json({ error: out.error })
    res.json({ result: out.result, rev: out.rev, replayed: !!out.replayed, state: stateFor(db, req.user) })
  })
  app.get('/api/notifications', requireUser, (req, res) => res.json({ notifications: stateFor(db, req.user).notifications }))

  // ---- administrator ----
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: cfg.maxUploadBytes, files: 1, fields: 20 } })
  const uploadOne = (req, res, next) => upload.single('file')(req, res, err => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'FILE_TOO_LARGE', `The file is larger than ${Math.round(cfg.maxUploadBytes / 1048576)} MB.`))
    next(new HttpError(400, 'UPLOAD_FAILED', err.message))
  })
  function storePdf(file) {
    if (!file || !file.buffer?.length) throw new HttpError(400, 'FILE_REQUIRED', 'Please choose a PDF file.')
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(415, 'NOT_A_PDF', 'Only PDF files are accepted (the file content is not a PDF).')
    const sha = crypto.createHash('sha256').update(file.buffer).digest('hex')
    const key = `${sha}.pdf`
    const dest = path.join(filesDir, key)
    try { if (!fs.existsSync(dest)) fs.writeFileSync(dest, file.buffer) } catch { throw new HttpError(500, 'STORAGE_FAILED', 'Could not save the file. Nothing was changed.') }
    return { key, sha, size: file.buffer.length, name: String(file.originalname || 'timetable.pdf').replace(/[^\w.\- ]+/g, '_').slice(0, 120) }
  }
  const checkDates = ({ effective_from, expires_on }) => {
    if (!validDate(effective_from)) throw new HttpError(422, 'INVALID_DATE', 'A valid effective date (YYYY-MM-DD) is required.')
    if (expires_on && !validDate(expires_on)) throw new HttpError(422, 'INVALID_DATE', 'The expiry date is not a valid date.')
    if (expires_on && expires_on < effective_from) throw new HttpError(422, 'INVALID_DATE', 'The expiry date cannot be before the effective date.')
  }
  const getVersion = id => { const v = db.prepare('SELECT * FROM versions WHERE id=?').get(Number(id)); if (!v) throw new HttpError(404, 'NOT_FOUND', 'Version not found.'); return v }
  const getTimetable = id => db.prepare('SELECT * FROM timetables WHERE id=?').get(id)

  app.get('/api/admin/timetables', requireAdmin, (req, res) => {
    const q = req.query, where = [], args = []
    for (const [param, col] of [['dept', 't.dept_id'], ['semester', 't.semester'], ['division', 't.division'], ['status', 'v.status'], ['year', 't.academic_year']]) if (q[param]) { where.push(`${col} = ?`); args.push(String(q[param])) }
    const rows = db.prepare(`SELECT v.*, t.dept_id, t.semester, t.division, t.academic_year, (SELECT COUNT(*) FROM entries e WHERE e.version_id=v.id) AS entry_count
      FROM versions v JOIN timetables t ON t.id=v.timetable_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.dept_id, t.semester, t.division, v.version_no DESC`).all(...args)
    const showInactive = q.include_inactive === '1'
    res.json({ versions: rows.filter(r => showInactive || isValidClass(r.dept_id, r.semester, r.division)).map(r => ({ ...listMeta(r), dept_id: r.dept_id, semester: r.semester, division: r.division, academic_year: r.academic_year, entry_count: r.entry_count })) })
  })

  app.get('/api/admin/versions/:id', requireAdmin, (req, res) => {
    const v = getVersion(req.params.id), t = getTimetable(v.timetable_id)
    const history = db.prepare('SELECT * FROM versions WHERE timetable_id=? ORDER BY version_no DESC').all(t.id).map(listMeta)
    const audit = db.prepare('SELECT * FROM audit WHERE timetable_id=? ORDER BY id DESC LIMIT 200').all(t.id).map(a => ({ ...a }))
    res.json({ version: publicVersion(v), timetable: { ...t }, entries: getEntries(db, v.id), warnings: warningsFor(db, v), history, audit })
  })

  // Upload a new timetable (new draft version). Optionally copy entries from an earlier version of the same timetable.
  app.post('/api/admin/versions', requireAdmin, uploadOne, wrap((req, res) => {
    const b = req.body || {}
    const dept = String(b.dept_id || ''), semester = String(b.semester || ''), division = String(b.division || ''), year = String(b.academic_year || '')
    if (!isValidClass(dept, semester, division)) throw new HttpError(422, 'INVALID_CLASS', classError(dept, semester, division))
    if (!validYear(year)) throw new HttpError(422, 'INVALID_YEAR', 'Academic year must look like 2026-27.')
    checkDates(b)
    if (!['draft', 'published'].includes(b.status || 'draft')) throw new HttpError(422, 'INVALID_STATUS', 'Status must be draft or published.')
    if (String(b.title || '').length > 200 || String(b.notes || '').length > 2000) throw new HttpError(422, 'TOO_LONG', 'Title or notes are too long.')
    const copyFrom = b.copy_from ? getVersion(b.copy_from) : null
    if (!req.file && !copyFrom) throw new HttpError(400, 'FILE_REQUIRED', 'Please choose a PDF file.')
    const stored = req.file ? storePdf(req.file) : null
    const now = nowIso()
    const created = tx(db, () => {
      db.prepare('INSERT OR IGNORE INTO timetables (dept_id, semester, division, academic_year, created_at) VALUES (?,?,?,?,?)').run(dept, semester, division, year, now)
      const t = db.prepare('SELECT * FROM timetables WHERE dept_id=? AND semester=? AND division=? AND academic_year=?').get(dept, semester, division, year)
      if (copyFrom && copyFrom.timetable_id !== t.id) throw new HttpError(422, 'COPY_MISMATCH', 'copy_from must belong to the same department, semester, division and year.')
      if (stored && b.allow_duplicate !== '1') {
        const dup = db.prepare("SELECT version_no, status FROM versions WHERE timetable_id=? AND file_sha256=? AND status<>'cancelled'").get(t.id, stored.sha)
        if (dup) throw new HttpError(409, 'DUPLICATE_FILE', `This exact file was already uploaded for ${classLabel(t)} (version ${dup.version_no}, ${dup.status}).`)
      }
      const vno = db.prepare('SELECT COALESCE(MAX(version_no),0)+1 AS n FROM versions WHERE timetable_id=?').get(t.id).n
      const file = stored || { key: copyFrom.file_key, sha: copyFrom.file_sha256, size: copyFrom.file_size, name: copyFrom.file_name }
      const legend = copyFrom ? copyFrom.legend_json : '{}', sheet = copyFrom ? copyFrom.sheet_json : '{}'
      const entries = copyFrom ? getEntries(db, copyFrom.id) : []
      const id = Number(db.prepare(`INSERT INTO versions (timetable_id, version_no, status, title, notes, effective_from, expires_on, file_key, file_name, file_sha256, file_size, legend_json, sheet_json, content_hash, source_version_id, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(t.id, vno, 'draft', String(b.title || '').trim(), String(b.notes || '').trim(), b.effective_from, b.expires_on || null, file.key, file.name, file.sha, file.size, legend, sheet, contentHash(entries, JSON.parse(legend), file.sha), copyFrom?.id ?? null, req.user.email, now, now).lastInsertRowid)
      setEntries(db, id, entries)
      writeAudit(db, req.user, 'upload', { at: now, timetableId: t.id, versionId: id, toStatus: 'draft', toVersion: vno, reason: String(b.notes || '').trim(), detail: { file: file.name, sha256: file.sha } })
      return { id, t }
    })
    if (b.status === 'published') {
      try {
        const out = afterOfficial(publishVersion(db, req.user, created.id, { replace: b.replace === '1', reason: String(b.notes || '') }, nowIso(), todayStr()))
        return res.status(201).json({ ...out, id: created.id })
      } catch (e) { if (e instanceof HttpError) { e.extra = { ...e.extra, draft_id: created.id }; e.message += ' The upload was saved as a draft.' } throw e }
    }
    res.status(201).json({ version: listMeta(getVersion(created.id)), id: created.id })
  }))

  app.put('/api/admin/versions/:id', requireAdmin, wrap((req, res) => {
    const v = getVersion(req.params.id)
    if (v.status !== 'draft') throw new HttpError(409, 'BAD_STATE', 'Only drafts can be edited. Create an editable draft from this version first.')
    const b = { effective_from: v.effective_from, expires_on: v.expires_on, ...req.body }
    checkDates(b)
    const title = String(b.title ?? v.title).slice(0, 200), notes = String(b.notes ?? v.notes).slice(0, 2000)
    db.prepare('UPDATE versions SET title=?, notes=?, effective_from=?, expires_on=?, updated_at=? WHERE id=?').run(title, notes, b.effective_from, b.expires_on || null, nowIso(), v.id)
    writeAudit(db, req.user, 'edit_details', { at: nowIso(), timetableId: v.timetable_id, versionId: v.id, fromVersion: v.version_no, toVersion: v.version_no, reason: String(req.body?.reason || '') })
    res.json({ version: listMeta(getVersion(v.id)) })
  }))

  app.put('/api/admin/versions/:id/entries', requireAdmin, wrap((req, res) => {
    const v = getVersion(req.params.id)
    if (v.status !== 'draft') throw new HttpError(409, 'BAD_STATE', 'Only drafts can be edited. Create an editable draft from this version first.')
    const entries = req.body?.entries
    if (!Array.isArray(entries) || entries.length > 400) throw new HttpError(422, 'INVALID_ENTRIES', 'entries must be an array of at most 400 items.')
    const problems = []
    entries.forEach((e, i) => { const errs = entryErrors(e || {}); if (errs.length) problems.push(`Row ${i + 1}: ${errs.join(', ')}`) })
    if (problems.length) throw new HttpError(422, 'INVALID_ENTRIES', problems.slice(0, 8).join('; '), { problems })
    const legend = req.body.legend && typeof req.body.legend === 'object' ? { faculty: req.body.legend.faculty || {}, subjects: req.body.legend.subjects || {} } : JSON.parse(v.legend_json)
    const before = getEntries(db, v.id)
    const hash = contentHash(entries, legend, v.file_sha256)
    const changed = hash !== v.content_hash
    tx(db, () => {
      setEntries(db, v.id, entries)
      db.prepare('UPDATE versions SET legend_json=?, content_hash=?, updated_at=? WHERE id=?').run(JSON.stringify(legend), hash, nowIso(), v.id)
      if (changed) writeAudit(db, req.user, 'edit_entries', { at: nowIso(), timetableId: v.timetable_id, versionId: v.id, fromVersion: v.version_no, toVersion: v.version_no, reason: String(req.body?.reason || ''), detail: { before: before.length, after: entries.length } })
    })
    res.json({ changed, warnings: warningsFor(db, getVersion(v.id)) })
  }))

  app.post('/api/admin/versions/:id/file', requireAdmin, uploadOne, wrap((req, res) => {
    const v = getVersion(req.params.id)
    if (v.status !== 'draft') throw new HttpError(409, 'BAD_STATE', 'The PDF of a draft can be replaced; for other versions create a new draft first.')
    const s = storePdf(req.file)
    if (s.sha === v.file_sha256) throw new HttpError(409, 'DUPLICATE_FILE', 'That is the same file already attached to this draft.')
    const entries = getEntries(db, v.id)
    db.prepare('UPDATE versions SET file_key=?, file_name=?, file_sha256=?, file_size=?, content_hash=?, updated_at=? WHERE id=?').run(s.key, s.name, s.sha, s.size, contentHash(entries, JSON.parse(v.legend_json), s.sha), nowIso(), v.id)
    writeAudit(db, req.user, 'replace_file', { at: nowIso(), timetableId: v.timetable_id, versionId: v.id, fromVersion: v.version_no, toVersion: v.version_no, detail: { file: s.name, sha256: s.sha } })
    res.json({ version: listMeta(getVersion(v.id)) })
  }))

  app.post('/api/admin/versions/:id/publish', requireAdmin, wrap((req, res) => res.json(afterOfficial(publishVersion(db, req.user, Number(req.params.id), { replace: req.body?.replace === true, reason: String(req.body?.reason || '') }, nowIso(), todayStr())))))
  for (const action of ['withdraw', 'archive', 'cancel']) {
    app.post(`/api/admin/versions/:id/${action}`, requireAdmin, wrap((req, res) => {
      const reason = String(req.body?.reason || '').trim()
      if (action !== 'cancel' && !reason) throw new HttpError(422, 'REASON_REQUIRED', 'A reason is required.')
      res.json(afterOfficial(changeStatus(db, req.user, Number(req.params.id), action, { reason }, nowIso())))
    }))
  }
  app.post('/api/admin/versions/:id/clone', requireAdmin, wrap((req, res) => {
    const restore = req.body?.restore === true
    res.status(201).json({ version: cloneVersion(db, req.user, Number(req.params.id), { reason: String(req.body?.reason || ''), action: restore ? 'restore' : 'clone' }, nowIso()) })
  }))
  app.get('/api/admin/audit', requireAdmin, (req, res) => {
    const rows = req.query.timetable_id ? db.prepare('SELECT * FROM audit WHERE timetable_id=? ORDER BY id DESC LIMIT 500').all(Number(req.query.timetable_id)) : db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 500').all()
    res.json({ audit: rows.map(r => ({ ...r })) })
  })

  // One-time import of a browser's saved (localStorage) data; refused once the server has real activity.
  app.post('/api/admin/state/import', requireAdmin, express.json({ limit: '25mb' }), (req, res) => {
    const out = importBrowserState(db, req.body?.state, todayStr(), nowIso())
    if (out.error) return res.status(out.status).json({ error: out.error })
    res.json({ ok: true })
  })
  // Demo-data reset: OFF unless the operator explicitly enables it (never run against real data by accident).
  app.post('/api/admin/state/reset', requireAdmin, (req, res) => {
    if (process.env.ALLOW_DEMO_RESET !== '1') return res.status(403).json({ error: { code: 'RESET_DISABLED', message: 'Demo reset is disabled on this server.' } })
    if (req.body?.confirm !== 'RESET') return res.status(422).json({ error: { code: 'CONFIRM_REQUIRED', message: 'Send {"confirm":"RESET"} to confirm.' } })
    mutate(db, cur => ({ state: { ...buildSeedState(todayStr()), seq: Math.max(cur.seq || 0, 100) + 1000, officialRooms: [] }, result: { ok: true } }), nowIso())
    syncOfficialLectures(db, todayStr(), nowIso())
    res.json({ ok: true })
  })

  // ---- errors ----
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'No such API route.')))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } })
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body.' } })
    if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body too large.' } })
    console.error(err)
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Nothing was changed.' } })
  })

  // ---- production: serve the built React app ----
  if (fs.existsSync(path.join(cfg.distDir, 'index.html'))) {
    app.use(express.static(cfg.distDir))
    app.use((req, res, next) => req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(cfg.distDir, 'index.html')) : next())
  }
  app.locals.db = db
  app.locals.actions = ACTION_NAMES
  return app
}
