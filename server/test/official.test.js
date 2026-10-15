import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../app.js'
import { OFFICIAL_TIMETABLES } from '../seed/official-data.js'
import { IT_TIMETABLES } from '../seed/it-data.js'
import { findWarnings, entryErrors } from '../validate.js'
import { DEPARTMENTS, SEMESTERS, divisionOptionsFor, isValidClass } from '../../shared/divisions.js'

const TODAY = '2026-10-13'
const J = { 'X-Requested-With': 'tsec-sync', 'Content-Type': 'application/json' }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-off-'))
let srv, base, db, admin, student
const start = (d = dir, skipOfficial = []) => { const app = createApp({ dataDir: d, today: () => TODAY, skipOfficial }); const s = app.listen(0); return { s, b: `http://localhost:${s.address().port}`, db: app.locals.db } }
const login = async (email, pw, role, b = base) => { const r = await fetch(b + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: pw, role }) }); return r.ok ? r.headers.get('set-cookie').split(';')[0] : null }
const api = async (cookie, method, url, body, b = base) => { const r = await fetch(b + url, { method, headers: { ...J, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json() } }
const published = async (dept, sem, div, c = student) => api(c, 'GET', `/api/published?dept=${dept}&semester=${encodeURIComponent(sem)}&division=${div}`)
const seedPdf = f => fs.readFileSync(new URL(`../seed/pdfs/${f}`, import.meta.url))

before(async () => { ;({ s: srv, b: base, db } = start()); admin = await login('admin@tsec.edu', 'admin123', 'management'); student = await login('student@tsec.edu', 'student123', 'student') })
after(() => srv.close())

// The mandatory mapping from the brief (sheet identifier -> department / division / semester).
// NOTE: BE-C1/2/3 are printed "COMP/VII/Cx" on the sheets, so they are SEMESTER VII (the brief's table said V).
const MAP = [
  ['T1-5', 'aids', 'SEM V', 'S1', 'T1-5.pdf'], ['T2-5', 'aids', 'SEM V', 'S2', 'T2-5.pdf'],
  ['B1-5', 'aids', 'SEM VII', 'S1', 'B1-5.pdf'], ['B2-5', 'aids', 'SEM VII', 'S2', 'B2-5.pdf'],
  ['BE-C1', 'comp', 'SEM VII', 'C1', 'BE-C1-July-2026.pdf'], ['BE-C2', 'comp', 'SEM VII', 'C2', 'BE-C2-July-2026.pdf'], ['BE-C3', 'comp', 'SEM VII', 'C3', 'BE-C3-July-2026.pdf'],
  ['TE-C1', 'comp', 'SEM V', 'C1', 'TE-C1-July-2026.pdf'], ['TE-C2', 'comp', 'SEM V', 'C2', 'TE-C2-July-2026.pdf'], ['TE-C3', 'comp', 'SEM V', 'C3', 'TE-C3-July-2026.pdf'],
  ['SE-C1', 'comp', 'SEM III', 'C1', 'SE-C1-July-2026.pdf'], ['SE-C2', 'comp', 'SEM III', 'C2', 'SE-C2-July-2026.pdf'], ['SE-C3', 'comp', 'SEM III', 'C3', 'SE-C3-July-2026.pdf'],
]

describe('every supplied sheet maps to the right class and shows its own data', () => {
  for (const [id, dept, sem, div, file] of MAP) {
    test(`${id} -> ${dept.toUpperCase()} ${sem} Division ${div}`, async () => {
      const r = await published(dept, sem, div)
      assert.equal(r.status, 200); assert.equal(r.json.state, 'published')
      const t = r.json.timetable
      assert.equal(t.sheet.identifier, id); assert.equal(t.sheet.sourceFile, file)
      assert.match(t.title, new RegExp(`\\(${id}\\)`))
      assert.equal(t.entries.length, OFFICIAL_TIMETABLES[id].entries.length)
      assert.equal(t.effective_from, '2026-07-06'); assert.equal(t.has_file, true)
      assert.ok(Object.keys(t.legend.faculty).length > 5)
      const f = await fetch(`${base}/api/files/${t.id}`, { headers: { cookie: student } })
      assert.deepEqual(Buffer.from(await f.arrayBuffer()), seedPdf(file), 'the original PDF is stored byte-for-byte')
    })
  }
  test('batches/lines of each sheet belong to its own division (nothing copied across divisions)', () => {
    for (const [id, dept, , div] of MAP) {
      const prefix = dept === 'comp' ? div : { S1: id.startsWith('T') ? 'T1' : 'B1', S2: id.startsWith('T') ? 'T2' : 'B2' }[div]
      const batches = [...new Set(OFFICIAL_TIMETABLES[id].entries.map(e => e.batch).filter(Boolean))]
      assert.ok(batches.length >= 2, `${id} has practical batches`)
      for (const b of batches) assert.ok(b.startsWith(prefix), `${id}: batch ${b} should start with ${prefix}`)
    }
  })
  test('the three COMP divisions of a semester are different timetables', () => {
    for (const lvl of ['SE', 'TE', 'BE']) {
      const hashes = ['C1', 'C2', 'C3'].map(c => JSON.stringify(OFFICIAL_TIMETABLES[`${lvl}-${c}`].entries))
      assert.equal(new Set(hashes).size, 3, `${lvl} sheets must not be copies of each other`)
    }
  })
  test('BE sheets are Semester VII (not V); TE sheets are Semester V; SE sheets are Semester III', async () => {
    assert.equal((await published('comp', 'SEM VII', 'C1')).json.timetable.sheet.identifier, 'BE-C1')
    assert.equal((await published('comp', 'SEM V', 'C1')).json.timetable.sheet.identifier, 'TE-C1')
    assert.equal((await published('comp', 'SEM III', 'C1')).json.timetable.sheet.identifier, 'SE-C1')
  })
  test('facts read from the printed sheets', async () => {
    const get = async (d, s, v) => (await published(d, s, v)).json.timetable.entries
    const has = (es, o) => es.some(e => Object.entries(o).every(([k, v]) => e[k] === v))
    const te1 = await get('comp', 'SEM V', 'C1')
    assert.ok(has(te1, { day: 'Monday', start: '13:00', end: '15:00', batch: 'C13', subject: 'WMC', faculty: 'PJ' }))
    assert.ok(has(te1, { day: 'Thursday', start: '15:00', end: '17:00', batch: 'C11', subject: 'DWM', faculty: 'AC' }))
    const be2 = await get('comp', 'SEM VII', 'C2')
    assert.ok(has(be2, { day: 'Wednesday', start: '13:00', end: '15:00', batch: 'C21', subject: 'BDA', faculty: 'ASD' }))
    assert.ok(has(be2, { day: 'Monday', start: '15:00', end: '16:30', subject: 'MIS', faculty: 'AK/SV', room: '404', label: '(4:30 PM)' }))
    const be3 = await get('comp', 'SEM VII', 'C3')
    assert.ok(has(be3, { day: 'Monday', start: '09:15', end: '11:15', batch: 'C32', subject: 'PR' }))
    const se3 = await get('comp', 'SEM III', 'C3')
    assert.ok(has(se3, { day: 'Wednesday', start: '13:00', end: '15:00', batch: 'C34', subject: 'COA', faculty: 'NS' }))
    const t1 = await get('aids', 'SEM V', 'S1')
    assert.ok(has(t1, { day: 'Wednesday', start: '08:00', end: '10:00', batch: 'T12', subject: 'AI&SC', faculty: 'VP', room: '805A' }))
    const t2 = await get('aids', 'SEM V', 'S2')
    assert.ok(has(t2, { day: 'Thursday', start: '13:00', end: '15:00', batch: 'T23', subject: 'Stats ML&DS', faculty: 'TD', room: '805A' }))
    const b1 = await get('aids', 'SEM VII', 'S1')
    assert.ok(has(b1, { day: 'Wednesday', start: '16:00', end: '17:00', subject: 'BCT', faculty: 'BJ' }))
    const b2 = await get('aids', 'SEM VII', 'S2')
    assert.ok(has(b2, { day: 'Wednesday', start: '13:00', end: '14:00', subject: 'BCT', faculty: 'BJ', room: '802' }))
  })
  test('IT timetables are untouched by the new import', async () => {
    for (const [id, m] of Object.entries({ S1: ['SEM III', 'I1'], T2: ['SEM V', 'I2'], B1: ['SEM VII', 'I1'] })) {
      const r = await published('it', m[0], m[1]); assert.equal(r.json.timetable.sheet.sourceFile, `${id}-TT.pdf`)
      assert.equal(r.json.timetable.entries.length, IT_TIMETABLES[id].entries.length)
    }
  })
  test('AI&DS Semester III now has its own S1 and S2 timetables (S1-5 / S2-5), kept separate', async () => {
    const s1 = (await published('aids', 'SEM III', 'S1')).json.timetable, s2 = (await published('aids', 'SEM III', 'S2')).json.timetable
    assert.equal(s1.sheet.identifier, 'S1-5'); assert.equal(s2.sheet.identifier, 'S2-5'); assert.notEqual(s1.id, s2.id)
    assert.notDeepEqual(s1.entries, s2.entries)
  })
})

describe('source consistency of the transcriptions', () => {
  test('no overlaps, no faculty clashes, valid entries, no duplicates in any supplied sheet', () => {
    for (const [id, t] of Object.entries(OFFICIAL_TIMETABLES)) {
      assert.deepEqual(findWarnings(t.entries, t.legend).filter(w => w.severity === 'warning'), [], id)
      const seen = new Set()
      for (const e of t.entries) {
        assert.deepEqual(entryErrors(e), [], `${id} ${JSON.stringify(e)}`)
        const k = [e.day, e.start, e.end, e.subject, e.batch, e.faculty, e.room].join('|')
        assert.ok(!seen.has(k), `${id} duplicate entry ${k}`); seen.add(k)
      }
    }
  })
  test('every faculty code used is defined in its sheet legend (compound codes like AK/SV split)', () => {
    for (const [id, t] of Object.entries(OFFICIAL_TIMETABLES)) {
      const used = new Set(t.entries.flatMap(e => String(e.faculty || '').split('/').map(x => x.trim())).filter(Boolean))
      for (const c of used) assert.ok(t.legend.faculty[c], `${id}: faculty code ${c} is not in the printed legend`)
    }
  })
  test('compound faculty (AK/SV) is shown with both names in the shared lectures', async () => {
    const st = (await api(admin, 'GET', '/api/state')).json.state
    const m = st.lectures.find(l => l.source === 'official' && l.deptId === 'comp' && l.semester === 'SEM VII' && l.division === 'C1' && l.subjectCode === 'MIS')
    assert.equal(m.faculty, 'Mr. Aejazul Khan / Dr. Shilpa Verma')
  })
})

describe('semesters III/V/VII only; AI&DS S3 and retired semesters are gone', () => {
  test('the API configuration offers exactly Semesters III, V and VII and no AI&DS S3', async () => {
    const cfg = (await api(null, 'GET', '/api/config')).json
    assert.deepEqual(cfg.semesters, ['SEM III', 'SEM V', 'SEM VII'])
    for (const d of cfg.departments) assert.deepEqual(Object.keys(cfg.divisions[d.id]), ['SEM III', 'SEM V', 'SEM VII'])
    for (const s of cfg.semesters) { assert.deepEqual(cfg.divisions.aids[s], ['S1', 'S2']); assert.deepEqual(cfg.divisions.comp[s], ['C1', 'C2', 'C3']); assert.deepEqual(cfg.divisions.it[s], ['I1', 'I2']) }
  })
  test('AI&DS S3 is invalid in every semester, no department offers an S3 division, and the old CI/CII/CIII names are retired', () => {
    for (const s of [...SEMESTERS, 'SEM I', 'SEM II', 'SEM IV', 'SEM VI', 'SEM VIII']) assert.equal(isValidClass('aids', s, 'S3'), false)
    for (const d of DEPARTMENTS) assert.ok(!divisionOptionsFor(d.id).includes('S3'))
    assert.equal(isValidClass('comp', 'SEM V', 'CI'), false, 'the old CI/CII/CIII names are retired in favour of C1/C2/C3')
  })
  test('retired semesters are rejected by the student API and by upload, for every department', async () => {
    for (const d of DEPARTMENTS) for (const s of ['SEM I', 'SEM II', 'SEM IV', 'SEM VI', 'SEM VIII']) {
      const div = divisionOptionsFor(d.id)[0] || '' // EXTC / Chemistry have no divisions
      assert.equal((await published(d.id, s, div)).status, 400, `${d.id} ${s}`)
      const fd = new FormData(); for (const [k, v] of Object.entries({ dept_id: d.id, semester: s, division: div, academic_year: '2026-27', effective_from: '2026-07-06' })) fd.append(k, v)
      fd.append('file', new Blob(['%PDF-1.4\nx\n%%EOF'], { type: 'application/pdf' }), 'x.pdf')
      const up = await fetch(base + '/api/admin/versions', { method: 'POST', headers: { 'X-Requested-With': 'tsec-sync', cookie: admin }, body: fd })
      assert.equal(up.status, 422, `upload ${d.id} ${s}`)
    }
  })
  test('AI&DS S3 cannot be requested, uploaded or published in any semester', async () => {
    for (const s of ['SEM III', 'SEM V', 'SEM VII']) {
      assert.equal((await published('aids', s, 'S3')).status, 400)
      const fd = new FormData(); for (const [k, v] of Object.entries({ dept_id: 'aids', semester: s, division: 'S3', academic_year: '2026-27', effective_from: '2026-07-06' })) fd.append(k, v)
      fd.append('file', new Blob(['%PDF-1.4\ny\n%%EOF'], { type: 'application/pdf' }), 'y.pdf')
      assert.equal((await fetch(base + '/api/admin/versions', { method: 'POST', headers: { 'X-Requested-With': 'tsec-sync', cookie: admin }, body: fd })).status, 422)
    }
  })
})

describe('importing into a database that already has data', () => {
  test('restarting never duplicates the official timetables; a class with user content gets a new version and the old one is archived, not deleted', async () => {
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-imp2-'))
    const boot = createApp({ dataDir: d2, today: () => TODAY, seed: false }) // schema + users only
    const bdb = boot.locals.db
    const now = '2026-09-01T00:00:00.000Z'
    // a user-uploaded AI&DS SEM V S1 timetable already published (entries + own PDF)
    bdb.prepare("INSERT INTO timetables (dept_id, semester, division, academic_year, created_at) VALUES ('aids','SEM V','S1','2026-27',?)").run(now)
    const ttId = bdb.prepare("SELECT id FROM timetables WHERE dept_id='aids'").get().id
    bdb.prepare(`INSERT INTO versions (timetable_id, version_no, status, title, notes, effective_from, file_key, file_name, file_sha256, file_size, created_by, created_at, updated_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(ttId, 1, 'published', 'my own upload', '', '2026-07-06', 'abc.pdf', 'mine.pdf', 'abc', 10, 'admin@tsec.edu', now, now, now)
    fs.mkdirSync(path.join(d2, 'files'), { recursive: true }); fs.writeFileSync(path.join(d2, 'files', 'abc.pdf'), '%PDF-1.4 mine')
    const vid = bdb.prepare('SELECT id FROM versions').get().id
    bdb.prepare("INSERT INTO entries (version_id, position, day, start, end, subject) VALUES (?,?,?,?,?,?)").run(vid, 0, 'Monday', '09:00', '10:00', 'MY-SUBJECT')

    const a = start(d2)
    try {
      const rows = a.db.prepare("SELECT version_no, status, title FROM versions WHERE timetable_id=? ORDER BY version_no").all(ttId).map(r => ({ ...r }))
      assert.deepEqual(rows.map(r => [r.version_no, r.status]), [[1, 'archived'], [2, 'published']])
      assert.match(rows[1].title, /T1-5/)
      assert.equal(a.db.prepare('SELECT COUNT(*) c FROM entries WHERE version_id=? AND subject=?').get(vid, 'MY-SUBJECT').c, 1, 'the user entries are kept')
      assert.ok(fs.existsSync(path.join(d2, 'files', 'abc.pdf')), 'the user PDF is kept')
      assert.ok(a.db.prepare("SELECT 1 FROM audit WHERE action='replaced' AND timetable_id=?").get(ttId))
      const total = a.db.prepare('SELECT COUNT(*) c FROM timetables').get().c
      assert.equal(total, 27)
    } finally { a.s.close() }
    const b = start(d2) // a second restart must not add or duplicate anything
    try {
      assert.equal(b.db.prepare('SELECT COUNT(*) c FROM timetables').get().c, 27)
      assert.equal(b.db.prepare('SELECT COUNT(*) c FROM versions').get().c, 28) // 27 official + the one user upload
      assert.equal(b.db.prepare("SELECT COUNT(DISTINCT timetable_id||'-'||file_sha256) c FROM versions").get().c, 28)
    } finally { b.s.close() }
  })
})

describe('retirement migration: obsolete classes leave the active schedule but history is preserved', () => {
  test('AI&DS S3, retired semesters and CI/CII/CIII data are archived/deactivated; nothing is deleted; S1/S2 and others are untouched', async () => {
    const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-ret-'))
    const first = start(d3, ['SE-ETC-1']); first.s.close() // keep EXTC SEM III free so this test can create its own row
    const g = first.db
    const now = '2026-09-01T00:00:00.000Z'
    const mk = (dept, sem, div, status) => {
      g.prepare("INSERT INTO timetables (dept_id, semester, division, academic_year, created_at) VALUES (?,?,?,?,?)").run(dept, sem, div, '2026-27', now)
      const t = g.prepare('SELECT id FROM timetables WHERE dept_id=? AND semester=? AND division=?').get(dept, sem, div).id
      g.prepare(`INSERT INTO versions (timetable_id, version_no, status, title, effective_from, file_key, file_name, file_sha256, file_size, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(t, 1, status, `${dept} ${sem} ${div}`, '2026-07-06', 'x.pdf', 'x.pdf', 'x', 1, 'admin@tsec.edu', now, now)
      const v = g.prepare('SELECT id FROM versions WHERE timetable_id=?').get(t).id
      g.prepare("INSERT INTO entries (version_id, position, day, start, end, subject) VALUES (?,?,?,?,?,?)").run(v, 0, 'Monday', '09:00', '10:00', 'OLD')
      return v
    }
    g.prepare("INSERT OR IGNORE INTO users (email,name,role,department,semester,division,password_hash) VALUES ('old.ci@tsec.edu','Old CI','student','comp','SEM III','CI','x')").run()
    const s3 = mk('aids', 'SEM V', 'S3', 'published'), sem4 = mk('extc', 'SEM IV', 'A', 'published'), sem6 = mk('it', 'SEM VI', 'I1', 'draft'), old = mk('comp', 'SEM III', 'CI', 'published'), keep = mk('extc', 'SEM III', '', 'published'), oldDiv = mk('chem', 'SEM V', 'A', 'published')
    // legacy demo lectures of retired classes inside the shared state
    const row = g.prepare('SELECT json FROM app_state').get(); const st = JSON.parse(row.json)
    const lec = (id, dept, sem, div) => ({ id, deptId: dept, semester: sem, division: div, subject: 'Legacy', faculty: 'Someone', weekday: 'Monday', start: '09:00', end: '10:00', roomId: 'C-301', slotId: 1 })
    st.lectures.push(lec('lec-old-1', 'extc', 'SEM IV', 'A'), lec('lec-old-2', 'aids', 'SEM V', 'S3'), lec('lec-old-3', 'chem', 'SEM V', 'A'), lec('lec-ok', 'extc', 'SEM V', ''))
    g.prepare('UPDATE app_state SET json=?').run(JSON.stringify(st))
    const counts = () => ({ users: g.prepare('SELECT COUNT(*) c FROM users').get().c, bookings: JSON.parse(g.prepare('SELECT json FROM app_state').get().json).bookings.length })
    const before = counts()

    const second = start(d3, ['SE-ETC-1'])
    try {
      const status = id => second.db.prepare('SELECT status FROM versions WHERE id=?').get(id).status
      assert.equal(status(s3), 'archived'); assert.equal(status(sem4), 'archived'); assert.equal(status(sem6), 'cancelled'); assert.equal(status(old), 'archived')
      assert.equal(status(keep), 'published', 'an active class is untouched'); assert.equal(status(oldDiv), 'archived', 'EXTC/Chemistry timetables that used the removed divisions A/B are retired')
      assert.equal(second.db.prepare('SELECT COUNT(*) c FROM entries WHERE subject=?').get('OLD').c, 6, 'entries of every version are kept')
      assert.ok(second.db.prepare("SELECT 1 FROM audit WHERE action='retire_inactive_class' AND version_id=?").get(s3), 'the retirement is audited')
      const a = await login('admin@tsec.edu', 'admin123', 'management', second.b)
      const list = await api(a, 'GET', '/api/admin/timetables', undefined, second.b)
      const labels = list.json.versions.map(v => `${v.dept_id}|${v.semester}|${v.division}`)
      assert.ok(!labels.includes('aids|SEM V|S3') && !labels.includes('extc|SEM IV|A') && !labels.includes('it|SEM VI|I1') && !labels.includes('comp|SEM III|CI'), 'not in the active admin list')
      assert.ok(labels.includes('extc|SEM III|') && !labels.includes('chem|SEM V|A') && labels.includes('aids|SEM V|S1') && labels.includes('aids|SEM V|S2'), 'S1, S2 and active classes stay')
      const all = await api(a, 'GET', '/api/admin/timetables?include_inactive=1', undefined, second.b)
      assert.ok(all.json.versions.some(v => v.division === 'S3'), 'history is still reachable on request')
      // cannot be revived by republishing
      const c = await api(a, 'POST', `/api/admin/versions/${s3}/clone`, { restore: true }, second.b)
      const p = await api(a, 'POST', `/api/admin/versions/${c.json.version.id}/publish`, {}, second.b)
      assert.equal(p.status, 422); assert.equal(p.json.error.code, 'INACTIVE_CLASS')
      // shared lectures of retired classes are deactivated, not deleted
      const state = (await api(a, 'GET', '/api/state', undefined, second.b)).json.state
      assert.equal(state.lectures.find(l => l.id === 'lec-old-1').inactive, true)
      assert.equal(state.lectures.find(l => l.id === 'lec-old-2').inactive, true)
      assert.equal(state.lectures.find(l => l.id === 'lec-old-3').inactive, true, 'a Chemistry lecture of the removed division A is retired')
      const ok = state.lectures.find(l => l.id === 'lec-ok'); assert.equal(ok.inactive, true); assert.equal(ok.inactiveReason, 'superseded', 'an active class that now has an official timetable shows only the official lectures')
      assert.equal(second.db.prepare("SELECT division FROM users WHERE email='old.ci@tsec.edu'").get().division, 'C1', 'CI -> C1 (exact rename)')
      assert.equal(second.db.prepare('SELECT COUNT(*) c FROM users').get().c, before.users, 'no account was removed')
      assert.equal(counts().bookings, before.bookings, 'bookings are untouched')
    } finally { second.s.close() }
  })
})
