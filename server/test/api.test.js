import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../app.js'
import { hashPassword } from '../auth.js'
import { divisionOptionsFor, isValidClass } from '../../shared/divisions.js'
import { IT_MAPPING, IT_TIMETABLES } from '../seed/it-data.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-test-'))
let srv, base, today = '2026-10-13', theApp
// These lifecycle tests upload/publish their own timetables for three classes, so those official imports are skipped here
const SKIP = ['S2-5', 'SE-ETC-1', 'TE-CHEM']
const start = (d = dir) => { const app = createApp({ dataDir: d, today: () => today, skipOfficial: SKIP }); const s = app.listen(0); theApp = app; return { s, b: `http://localhost:${s.address().port}`, app } }
const J = { 'X-Requested-With': 'tsec-sync', 'Content-Type': 'application/json' }
async function login(b, email, password, role) {
  const r = await fetch(b + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password, role }) })
  return r.ok ? r.headers.get('set-cookie').split(';')[0] : null
}
const call = async (cookie, method, url, body, b = base) => {
  const r = await fetch(b + url, { method, headers: { ...J, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let json; try { json = JSON.parse(text) } catch { json = text }
  return { status: r.status, json }
}
let seq = 0
const pdf = (tag = '') => new Blob([`%PDF-1.4\n% test ${tag} ${Date.now()} ${seq++}\n%%EOF`], { type: 'application/pdf' })
async function uploadForm(cookie, fields, file = pdf('x'), b = base) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  if (file) fd.append('file', file, 'tt.pdf')
  const r = await fetch(b + '/api/admin/versions', { method: 'POST', headers: { 'X-Requested-With': 'tsec-sync', ...(cookie ? { cookie } : {}) }, body: fd })
  return { status: r.status, json: await r.json() }
}
// AI&DS SEM III has NO supplied official timetable, so admin-lifecycle tests can use it freely
const base1 = { dept_id: 'aids', semester: 'SEM III', division: 'S2', academic_year: '2026-27', effective_from: '2026-07-06', title: 'AIDS III S2' }
let admin, student, teacher, itStudent

before(async () => {
  ;({ s: srv, b: base } = start())
  admin = await login(base, 'admin@tsec.edu', 'admin123', 'management')
  student = await login(base, 'student@tsec.edu', 'student123', 'student')
  itStudent = await login(base, 'student.it@tsec.edu', 'student123', 'student')
  teacher = await login(base, 'teacher@tsec.edu', 'teacher123', 'teacher')
})
after(() => srv.close())

describe('division configuration', () => {
  test('AI&DS has exactly S1 and S2 in every active semester (S3 is gone)', () => {
    for (const s of ['SEM III', 'SEM V', 'SEM VII']) assert.deepEqual(divisionOptionsFor('aids', s), ['S1', 'S2'])
    assert.deepEqual(divisionOptionsFor('aids'), ['S1', 'S2'])
  })
  test('IT keeps I1/I2 and is NOT renamed to S1/S2/S3; AI&DS change does not touch other departments', () => {
    for (const s of ['SEM III', 'SEM V', 'SEM VII']) assert.deepEqual(divisionOptionsFor('it', s), ['I1', 'I2'])
    assert.equal(isValidClass('it', 'SEM III', 'S1'), false)
    assert.equal(isValidClass('aids', 'SEM III', 'I1'), false)
    assert.deepEqual(divisionOptionsFor('comp', 'SEM III'), ['C1', 'C2', 'C3'])
    assert.deepEqual(divisionOptionsFor('extc', 'SEM V'), [], 'EXTC has no divisions')
    assert.deepEqual(divisionOptionsFor('chem', 'SEM V'), [], 'Chemistry has no divisions')
  })
  test('file identifiers map exactly as specified', () => {
    assert.deepEqual(IT_MAPPING, { S1: { semester: 'SEM III', division: 'I1' }, S2: { semester: 'SEM III', division: 'I2' }, T1: { semester: 'SEM V', division: 'I1' }, T2: { semester: 'SEM V', division: 'I2' }, B1: { semester: 'SEM VII', division: 'I1' }, B2: { semester: 'SEM VII', division: 'I2' } })
  })
})

describe('IT timetables (scenarios 1-6)', () => {
  for (const [id, m] of Object.entries(IT_MAPPING)) {
    test(`IT ${m.semester} ${m.division} shows ${id}-TT`, async () => {
      const r = await call(student, 'GET', `/api/published?dept=it&semester=${encodeURIComponent(m.semester)}&division=${m.division}`)
      assert.equal(r.status, 200); assert.equal(r.json.state, 'published')
      const t = r.json.timetable
      assert.equal(t.sheet.sourceFile, `${id}-TT.pdf`)
      assert.equal(t.entries.length, IT_TIMETABLES[id].entries.length)
      assert.equal(t.effective_from, '2026-07-06')
      assert.equal(t.has_file, true)
      assert.equal(t.sheet.sourceIssues, undefined, 'source issues are admin-only')
      const f = await fetch(`${base}/api/files/${t.id}`, { headers: { cookie: student } })
      assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'application/pdf')
      assert.equal(Buffer.from(await f.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
    })
  }
  test('a few transcribed facts match the printed sheets', async () => {
    const r = await call(student, 'GET', '/api/published?dept=it&semester=SEM%20V&division=I1')
    const wed = r.json.timetable.entries.filter(e => e.day === 'Wednesday' && e.start >= '13:00')
    assert.deepEqual(wed.map(e => [e.subject, e.faculty, e.start, e.end, e.label]), [['WMC', 'GK', '13:00', '14:00', '(1 to 2)'], ['WT', 'SR', '14:00', '15:00', '(2 to 3)'], ['IKS LAB', 'ABM', '15:00', '17:00', '(3 to 5)']])
    assert.equal(r.json.timetable.sheet.room, '1101')
  })
  test('invalid division for a department is rejected', async () => {
    assert.equal((await call(student, 'GET', '/api/published?dept=it&semester=SEM%20III&division=S1')).status, 400)
  })
  test('admin sees the transcription anomalies as warnings, not silent edits', async () => {
    const list = await call(admin, 'GET', '/api/admin/timetables?dept=it&semester=SEM%20VII&division=I2')
    const d = await call(admin, 'GET', `/api/admin/versions/${list.json.versions[0].id}`)
    assert.ok(d.json.warnings.some(w => w.type === 'batch_overlap' && /B21/.test(w.message)))
    assert.ok(d.json.warnings.some(w => w.type === 'batch_overlap' && /B22/.test(w.message)))
    assert.ok(d.json.version.sheet.sourceIssues.length > 0)
  })
  test('parallel lab batches are not flagged as conflicts', async () => {
    const list = await call(admin, 'GET', '/api/admin/timetables?dept=it&semester=SEM%20V&division=I1')
    const d = await call(admin, 'GET', `/api/admin/versions/${list.json.versions[0].id}`)
    assert.equal(d.json.warnings.filter(w => w.severity === 'warning').length, 0)
  })
})

describe('authorization (scenarios 10-11)', () => {
  test('unauthenticated requests are refused', async () => {
    assert.equal((await call(null, 'GET', '/api/admin/timetables')).status, 401)
    assert.equal((await call(null, 'GET', '/api/published?dept=it&semester=SEM%20III&division=I1')).status, 401)
    assert.equal((await call(null, 'POST', '/api/admin/versions/1/publish', {})).status, 401)
  })
  test('students and teachers cannot use any admin route', async () => {
    for (const c of [student, teacher]) {
      for (const [m, u, b] of [['GET', '/api/admin/timetables'], ['GET', '/api/admin/versions/1'], ['POST', '/api/admin/versions/1/publish', {}], ['POST', '/api/admin/versions/1/withdraw', { reason: 'x' }], ['POST', '/api/admin/versions/1/archive', { reason: 'x' }], ['POST', '/api/admin/versions/1/clone', {}], ['PUT', '/api/admin/versions/1/entries', { entries: [] }], ['GET', '/api/admin/audit']]) {
        assert.equal((await call(c, m, u, b)).status, 403, `${m} ${u}`)
      }
      const up = await uploadForm(c, base1)
      assert.equal(up.status, 403)
    }
  })
  test('a forged cookie or tampered role grants nothing', async () => {
    assert.equal((await call('tsec_sid=forged', 'GET', '/api/admin/timetables')).status, 401)
    assert.equal((await call(student, 'GET', '/api/admin/timetables', undefined)).status, 403)
  })
  test('state-changing requests without the CSRF header are refused', async () => {
    const r = await fetch(base + '/api/admin/versions/1/withdraw', { method: 'POST', headers: { cookie: admin, 'Content-Type': 'application/json' }, body: '{"reason":"x"}' })
    assert.equal(r.status, 403)
  })
  test('a failed login clears any older session cookie', async () => {
    const r = await fetch(base + '/api/login', { method: 'POST', headers: { ...J, cookie: student }, body: JSON.stringify({ email: 'admin@tsec.edu', password: 'wrong', role: 'management' }) })
    assert.equal(r.status, 401)
    assert.match(r.headers.get('set-cookie') || '', /tsec_sid=;/)
    assert.equal((await call(student, 'GET', '/api/me')).status, 401, 'the old session was destroyed on the server too')
    student = await login(base, 'student@tsec.edu', 'student123', 'student')
  })
  test('wrong password / wrong role cannot log in', async () => {
    assert.equal(await login(base, 'admin@tsec.edu', 'nope', 'management'), null)
    assert.equal(await login(base, 'student@tsec.edu', 'student123', 'management'), null)
  })
})

describe('admin lifecycle (scenario 9) + validation (14)', () => {
  let draftId
  test('rejects non-PDF content, missing file, bad division, bad year, bad dates', async () => {
    assert.equal((await uploadForm(admin, base1, new Blob(['hello world'], { type: 'application/pdf' }))).json.error.code, 'NOT_A_PDF')
    assert.equal((await uploadForm(admin, base1, null)).json.error.code, 'FILE_REQUIRED')
    assert.equal((await uploadForm(admin, { ...base1, division: 'A' })).json.error.code, 'INVALID_CLASS')
    assert.equal((await uploadForm(admin, { ...base1, academic_year: '2026-30' })).json.error.code, 'INVALID_YEAR')
    assert.equal((await uploadForm(admin, { ...base1, effective_from: '2026-02-31' })).json.error.code, 'INVALID_DATE')
    assert.equal((await uploadForm(admin, { ...base1, expires_on: '2026-01-01' })).json.error.code, 'INVALID_DATE')
  })
  test('upload creates a DRAFT that students cannot see', async () => {
    const r = await uploadForm(admin, base1)
    assert.equal(r.status, 201); draftId = r.json.id
    assert.equal(r.json.version.status, 'draft')
    const s = await call(student, 'GET', '/api/published?dept=aids&semester=SEM%20III&division=S2')
    assert.equal(s.json.state, 'none')
    assert.equal((await fetch(`${base}/api/files/${draftId}`, { headers: { cookie: student } })).status, 404)
    assert.equal((await fetch(`${base}/api/files/${draftId}`, { headers: { cookie: admin } })).status, 200) // preview for admin
  })
  test('duplicate file upload for the same class is refused', async () => {
    const same = new Blob(['%PDF-1.4\nsame-bytes\n%%EOF'], { type: 'application/pdf' })
    const a = await uploadForm(admin, { ...base1, semester: 'SEM VII', division: 'S1' }, same)
    assert.equal(a.status, 201)
    const b = await uploadForm(admin, { ...base1, semester: 'SEM VII', division: 'S1' }, new Blob(['%PDF-1.4\nsame-bytes\n%%EOF'], { type: 'application/pdf' }))
    assert.equal(b.status, 409); assert.equal(b.json.error.code, 'DUPLICATE_FILE')
  })
  test('draft entries can be edited, validated, and produce warnings (not rejections) for overlaps', async () => {
    const bad = await call(admin, 'PUT', `/api/admin/versions/${draftId}/entries`, { entries: [{ day: 'Funday', start: '10:00', end: '09:00', subject: '' }] })
    assert.equal(bad.status, 422)
    const entries = [
      { day: 'Monday', start: '09:30', end: '10:30', kind: 'lecture', subject: 'ML', faculty: 'AB', room: '101' },
      { day: 'Monday', start: '10:00', end: '11:00', kind: 'lecture', subject: 'DL', faculty: 'CD', room: '102' },
      { day: 'Tuesday', start: '10:30', end: '12:30', kind: 'lab', subject: 'ML', batch: 'S21', faculty: 'AB', room: '201' },
      { day: 'Tuesday', start: '10:30', end: '12:30', kind: 'lab', subject: 'DL', batch: 'S22', faculty: 'CD', room: '202' },
    ]
    const ok = await call(admin, 'PUT', `/api/admin/versions/${draftId}/entries`, { entries })
    assert.equal(ok.status, 200); assert.equal(ok.json.changed, true)
    assert.deepEqual(ok.json.warnings.filter(w => w.severity === 'warning').map(w => w.type), ['division_overlap'])
    const again = await call(admin, 'PUT', `/api/admin/versions/${draftId}/entries`, { entries })
    assert.equal(again.json.changed, false, 'saving identical content is a no-op')
  })
  test('publish -> students see it, notification is created once', async () => {
    const p = await call(admin, 'POST', `/api/admin/versions/${draftId}/publish`, {})
    assert.equal(p.status, 200); assert.equal(p.json.notified, true)
    const s = await call(student, 'GET', '/api/published?dept=aids&semester=SEM%20III&division=S2')
    assert.equal(s.json.state, 'published'); assert.equal(s.json.timetable.entries.length, 4)
    assert.equal((await call(admin, 'POST', `/api/admin/versions/${draftId}/publish`, {})).status, 409) // not a draft any more
    // official notices travel through the shared notification list; only that class's students receive them
    theApp.locals.db.prepare('INSERT OR IGNORE INTO users (email,name,role,department,semester,division,password_hash) VALUES (?,?,?,?,?,?,?)').run('aids5@tsec.edu', 'AIDS III S2', 'student', 'aids', 'SEM III', 'S2', hashPassword('pw'))
    const aids = await login(base, 'aids5@tsec.edu', 'pw', 'student')
    const mine = (await call(aids, 'GET', '/api/notifications')).json.notifications.filter(x => /New timetable published/.test(x.title) && /AIDS SEM III · Division S2/.test(x.title))
    assert.equal(mine.length, 1)
    assert.match(mine[0].link, /\/app\/timetable\?dept=aids&semester=SEM\+III&division=S2&tab=official/)
    assert.equal((await call(student, 'GET', '/api/notifications')).json.notifications.some(x => /AIDS SEM III/.test(x.title)), false)
  })
  test('edited published timetable needs a draft; replacing requires explicit confirmation; old version archived', async () => {
    assert.equal((await call(admin, 'PUT', `/api/admin/versions/${draftId}/entries`, { entries: [] })).status, 409)
    const c = await call(admin, 'POST', `/api/admin/versions/${draftId}/clone`, { reason: 'fix room' })
    assert.equal(c.status, 201)
    const v2 = c.json.version.id
    const e = (await call(admin, 'GET', `/api/admin/versions/${v2}`)).json.entries
    e[0].room = '999'
    await call(admin, 'PUT', `/api/admin/versions/${v2}/entries`, { entries: e })
    const refuse = await call(admin, 'POST', `/api/admin/versions/${v2}/publish`, {})
    assert.equal(refuse.status, 409); assert.equal(refuse.json.error.code, 'REPLACE_REQUIRED')
    const s = await call(student, 'GET', '/api/published?dept=aids&semester=SEM%20III&division=S2')
    assert.equal(s.json.timetable.entries[0].room, '101', 'students still see the old one until confirmed')
    const ok = await call(admin, 'POST', `/api/admin/versions/${v2}/publish`, { replace: true, reason: 'room correction' })
    assert.equal(ok.status, 200); assert.equal(ok.json.replaced, 1); assert.equal(ok.json.notified, true)
    const s2 = await call(student, 'GET', '/api/published?dept=aids&semester=SEM%20III&division=S2')
    assert.equal(s2.json.timetable.entries[0].room, '999')
    const d = (await call(admin, 'GET', `/api/admin/versions/${v2}`)).json
    assert.deepEqual(d.history.map(h => [h.version_no, h.status]), [[2, 'published'], [1, 'archived']])
    assert.ok(d.audit.some(a => a.action === 'publish_replace' && a.user_email === 'admin@tsec.edu' && a.from_version === 1 && a.to_version === 2))
    draftId = v2
  })
  test('republishing identical content sends no duplicate notification', async () => {
    const before = (await call(admin, 'GET', '/api/notifications')).json.notifications.length
    const c = await call(admin, 'POST', `/api/admin/versions/${draftId}/clone`, {})
    const out = await call(admin, 'POST', `/api/admin/versions/${c.json.version.id}/publish`, { replace: true })
    assert.equal(out.json.notified, false)
    assert.equal((await call(admin, 'GET', '/api/notifications')).json.notifications.length, before)
    draftId = c.json.version.id
  })
  test('restore an older version as a new draft', async () => {
    const hist = (await call(admin, 'GET', `/api/admin/versions/${draftId}`)).json.history
    const archivedV1 = hist.find(h => h.version_no === 1)
    const rr = await call(admin, 'POST', `/api/admin/versions/${archivedV1.id}/clone`, { restore: true, reason: 'wrong fix' })
    assert.equal(rr.status, 201)
    const d = (await call(admin, 'GET', `/api/admin/versions/${rr.json.version.id}`)).json
    assert.equal(d.version.status, 'draft'); assert.equal(d.entries[0].room, '101')
    assert.ok(d.audit.some(a => a.action === 'restore'))
  })
  test('withdraw requires a reason, hides the timetable, shows an informative state, and notifies', async () => {
    const pubId = (await call(admin, 'GET', '/api/admin/timetables?dept=aids&semester=SEM%20III&division=S2&status=published')).json.versions[0].id
    assert.equal((await call(admin, 'POST', `/api/admin/versions/${pubId}/withdraw`, {})).json.error.code, 'REASON_REQUIRED')
    const w = await call(admin, 'POST', `/api/admin/versions/${pubId}/withdraw`, { reason: 'Printed error' })
    assert.equal(w.status, 200); assert.equal(w.json.notified, true)
    const s = await call(student, 'GET', '/api/published?dept=aids&semester=SEM%20III&division=S2')
    assert.equal(s.json.state, 'withdrawn'); assert.match(s.json.message, /withdrawn/); assert.equal(s.json.timetable, undefined)
    assert.equal((await fetch(`${base}/api/files/${pubId}`, { headers: { cookie: student } })).status, 404)
  })
  test('cancel a pending draft and archive a withdrawn version (nothing is ever hard-deleted)', async () => {
    const drafts = (await call(admin, 'GET', '/api/admin/timetables?dept=aids&semester=SEM%20III&division=S2&status=draft')).json.versions
    assert.ok(drafts.length > 0)
    assert.equal((await call(admin, 'POST', `/api/admin/versions/${drafts[0].id}/cancel`, {})).json.version.status, 'cancelled')
    const wd = (await call(admin, 'GET', '/api/admin/timetables?dept=aids&semester=SEM%20III&division=S2&status=withdrawn')).json.versions[0]
    assert.equal((await call(admin, 'POST', `/api/admin/versions/${wd.id}/archive`, { reason: 'obsolete' })).json.version.status, 'archived')
    const all = (await call(admin, 'GET', '/api/admin/timetables?dept=aids&semester=SEM%20III&division=S2')).json.versions
    assert.ok(all.length >= 4)
  })
  test('upload with status=published and an existing published timetable asks for confirmation but keeps the draft', async () => {
    const a = await uploadForm(admin, { ...base1, dept_id: 'extc', semester: 'SEM III', division: '', status: 'published' })
    assert.equal(a.status, 201)
    const b = await uploadForm(admin, { ...base1, dept_id: 'extc', semester: 'SEM III', division: '', status: 'published' })
    assert.equal(b.status, 409); assert.equal(b.json.error.code, 'REPLACE_REQUIRED'); assert.ok(b.json.error.draft_id)
    const c = await uploadForm(admin, { ...base1, dept_id: 'extc', semester: 'SEM III', division: '', status: 'published', replace: '1' })
    assert.equal(c.status, 201)
  })
  test('expiry hides a timetable from students', async () => {
    const a = await uploadForm(admin, { ...base1, dept_id: 'chem', semester: 'SEM V', division: '', expires_on: '2026-12-31', status: 'published' })
    assert.equal(a.status, 201)
    const q = '/api/published?dept=chem&semester=SEM%20V&division='
    assert.equal((await call(student, 'GET', q)).json.state, 'published')
    today = '2027-01-02'
    assert.equal((await call(student, 'GET', q)).json.state, 'expired')
    today = '2026-10-13'
  })
  test('students get notifications only for their own class', async () => {
    const n = await call(itStudent, 'GET', '/api/notifications')
    assert.ok(n.json.notifications.every(x => x.dept_id === 'it' && x.division === 'I1' && x.semester === 'SEM VII'))
  })
  test('a too-large upload is refused cleanly', async () => {
    const big = new Blob(['%PDF-1.4\n', Buffer.alloc(11 * 1024 * 1024)], { type: 'application/pdf' })
    const r = await uploadForm(admin, { ...base1, semester: 'SEM VII', division: 'S1' }, big)
    assert.equal(r.status, 413); assert.equal(r.json.error.code, 'FILE_TOO_LARGE')
  })
})

describe('persistence (scenario 12)', () => {
  test('data survives an application restart; IT import is not duplicated', async () => {
    srv.close()
    const second = start()
    try {
      const cookie = await login(second.b, 'student.it@tsec.edu', 'student123', 'student')
      const r = await call(cookie, 'GET', '/api/published?dept=it&semester=SEM%20VII&division=I1', undefined, second.b)
      assert.equal(r.json.state, 'published')
      const a = await login(second.b, 'admin@tsec.edu', 'admin123', 'management')
      const all = await call(a, 'GET', '/api/admin/timetables?dept=it', undefined, second.b)
      assert.equal(all.json.versions.length, 6)
      const aids = await call(a, 'GET', '/api/admin/timetables?dept=aids', undefined, second.b)
      assert.ok(aids.json.versions.length > 5)
    } finally { second.s.close() }
    ;({ s: srv, b: base } = start()) // reopen for the after() hook
  })
})
