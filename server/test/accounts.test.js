import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../app.js'
import { hashPassword } from '../auth.js'
import { DEMO_USERS } from '../seed.js'
import { OFFICIAL_TIMETABLES } from '../seed/official-data.js'
import { hasDivisions, isValidClass, divisionOptionsFor } from '../../shared/divisions.js'

const TODAY = '2026-10-13'
const J = { 'X-Requested-With': 'tsec-sync', 'Content-Type': 'application/json' }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-acc-'))
let srv, base, db
const start = (d = dir, skipOfficial = ['TE-ETC-1']) => { const app = createApp({ dataDir: d, today: () => TODAY, skipOfficial }); const s = app.listen(0); return { s, b: `http://localhost:${s.address().port}`, db: app.locals.db } }
const login = async (email, pw, role, b = base) => { const r = await fetch(b + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: pw, role }) }); return r.ok ? r.headers.get('set-cookie').split(';')[0] : null }
const api = async (cookie, method, url, body, b = base) => { const r = await fetch(b + url, { method, headers: { ...J, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, json: await r.json() } }
before(() => { ;({ s: srv, b: base, db } = start()) })
after(() => srv.close())

// The five sample accounts requested (+ the unchanged administrator). Divisions of the students were not specified: C1 / S1 / I1 are placeholders.
const ACCOUNTS = [
  { email: 'teacher@tsec.edu', pw: 'teacher123', role: 'teacher', name: 'Dr. Rupali Sarode', department: 'comp' },
  { email: 'teacher2@tsec.edu', pw: 'teacher123', role: 'teacher', name: 'Dr. Sakshi Surve', department: 'comp' },
  { email: 'student@tsec.edu', pw: 'student123', role: 'student', name: 'Heeya Shewkani', department: 'comp', semester: 'SEM V', division: 'C1' },
  { email: 'student.aids@tsec.edu', pw: 'student123', role: 'student', name: 'Dhwani Shriyan', department: 'aids', semester: 'SEM III', division: 'S1' },
  { email: 'student.it@tsec.edu', pw: 'student123', role: 'student', name: 'Tanisha Thakur', department: 'it', semester: 'SEM VII', division: 'I1' },
]

describe('the five sample accounts', () => {
  for (const a of ACCOUNTS) {
    test(`${a.name} logs in as ${a.role} and the profile is correct`, async () => {
      const c = await login(a.email, a.pw, a.role)
      assert.ok(c, 'login succeeds through the normal authentication flow')
      const me = (await api(c, 'GET', '/api/me')).json.user
      assert.equal(me.name, a.name); assert.equal(me.role, a.role); assert.equal(me.department, a.department)
      if (a.role === 'student') { assert.equal(me.semester, a.semester); assert.equal(me.division, a.division); assert.ok(isValidClass(me.department, me.semester, me.division), 'the student belongs to a real, active class') }
      assert.equal(me.password_hash, undefined, 'the password hash is never exposed')
      assert.equal(await login(a.email, a.pw, a.role === 'student' ? 'teacher' : 'student'), null, 'roles cannot be interchanged at login')
      assert.equal(await login(a.email, 'wrong-password', a.role), null)
    })
  }
  test('exactly these accounts exist (plus the administrator), no duplicates, passwords are hashed, no stale sample users', () => {
    const rows = db.prepare('SELECT email, name, role, password_hash FROM users ORDER BY email').all()
    assert.equal(new Set(rows.map(r => r.email.toLowerCase())).size, rows.length, 'no duplicate emails')
    assert.deepEqual(rows.map(r => r.email).sort(), [...ACCOUNTS.map(a => a.email), 'admin@tsec.edu'].sort())
    assert.equal(rows.filter(r => r.role === 'teacher').length, 2); assert.equal(rows.filter(r => r.role === 'student').length, 3)
    for (const r of rows) assert.match(r.password_hash, /^scrypt\$/)
    assert.deepEqual(DEMO_USERS.map(u => u[0]).sort(), rows.map(r => r.email).sort(), 'the seed list and the database agree')
  })
  test('no source file still refers to the replaced sample users', () => {
    const old = [['Prof.', 'R.', 'Kulkarni'].join(' '), ['Ananya', 'Mehta'].join(' '), ['Rohan', 'Desai'].join(' '), ['Prof.', 'M.', 'Shah'].join(' '), ['Shilpa', 'Verma', '(demo)'].join(' ')]
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const hits = []
    const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'data', '.git', '.vite', 'pdfs'].includes(f.name)) continue
      const p = path.join(d, f.name)
      if (f.isDirectory()) walk(p)
      else if (/\.(js|jsx|md|json)$/.test(f.name) && !p.endsWith('accounts.test.js') && !p.endsWith('package-lock.json')) { const t = fs.readFileSync(p, 'utf8'); for (const o of old) if (t.includes(o)) hits.push(`${path.relative(root, p)}: ${o}`) } } }
    for (const d of ['src', 'server', 'shared']) walk(path.join(root, d))
    assert.deepEqual(hits, [])
  })
})

describe('teacher <-> lecture ownership comes from the official sheets', () => {
  const nameOf = (t, code) => t.legend.faculty[code]
  test('every official COMP lecture printed with Dr. Rupali Sarode (RS) / Dr. Sakshi Surve (SMS) belongs to that account, and nothing else does', async () => {
    const admin = await login('admin@tsec.edu', 'admin123', 'management')
    const st = (await api(admin, 'GET', '/api/state')).json.state
    for (const who of ['Dr. Rupali Sarode', 'Dr. Sakshi Surve']) {
      let expected = 0
      for (const t of Object.values(OFFICIAL_TIMETABLES)) for (const e of t.entries) if (e.faculty && !e.faculty.includes('/') && nameOf(t, e.faculty) === who) expected++
      const mine = st.lectures.filter(l => l.source === 'official' && l.faculty === who)
      assert.ok(expected > 0, `${who} is printed on the supplied sheets`)
      assert.equal(mine.length, expected, `${who}: the lectures owned by the account equal the entries printed on the sheets`)
      assert.ok(mine.every(l => l.deptId === 'comp'), 'all of them are Computer Engineering lectures')
    }
    // the two teachers never own each other's lectures
    const rs = new Set(st.lectures.filter(l => l.faculty === 'Dr. Rupali Sarode').map(l => l.id))
    assert.ok(st.lectures.filter(l => l.faculty === 'Dr. Sakshi Surve').every(l => !rs.has(l.id)))
  })
  test("each teacher sees their own lectures and only their own requests; a teacher cannot change the other's lecture", async () => {
    const rupali = await login('teacher@tsec.edu', 'teacher123', 'teacher'), sakshi = await login('teacher2@tsec.edu', 'teacher123', 'teacher')
    const st = (await api(rupali, 'GET', '/api/state')).json.state
    const hers = st.lectures.find(l => l.source === 'official' && l.faculty === 'Dr. Rupali Sarode' && l.weekday === 'Monday')
    const r = await api(sakshi, 'POST', '/api/actions/changeLecture', { input: { lectureId: hers.id, date: '2026-10-19', newRoomId: 'C-301', reason: 'x' }, opId: 'sakshi-try-0001' })
    assert.equal(r.json.result.ok, false); assert.match(r.json.result.message, /permission/i)
  })
})

describe('EXTC and Chemistry have one class per semester (no divisions)', () => {
  test('configuration: no divisions, class key uses the empty division, divisions of other departments untouched', () => {
    for (const d of ['extc', 'chem']) { assert.equal(hasDivisions(d), false); for (const s of ['SEM III', 'SEM V', 'SEM VII']) { assert.deepEqual(divisionOptionsFor(d, s), []); assert.equal(isValidClass(d, s, ''), true); assert.equal(isValidClass(d, s, 'A'), false); assert.equal(isValidClass(d, s, 'B'), false) } }
    assert.deepEqual(divisionOptionsFor('aids', 'SEM III'), ['S1', 'S2'], 'AI&DS Semester III keeps S1 and S2')
    assert.deepEqual(divisionOptionsFor('comp', 'SEM V'), ['C1', 'C2', 'C3']); assert.deepEqual(divisionOptionsFor('it', 'SEM VII'), ['I1', 'I2'])
  })
  test('the API accepts EXTC/Chemistry with NO division, refuses one, and every student of a semester sees the same timetable', async () => {
    const admin = await login('admin@tsec.edu', 'admin123', 'management')
    const cfg = (await api(null, 'GET', '/api/config')).json
    for (const d of ['extc', 'chem']) for (const s of cfg.semesters) assert.deepEqual(cfg.divisions[d][s], [])
    const stu = await login('student@tsec.edu', 'student123', 'student')
    assert.equal((await api(stu, 'GET', '/api/published?dept=extc&semester=SEM%20III')).json.timetable.sheet.identifier, 'SE-ETC-1', 'EXTC SEM III: valid class, no division needed')
    const bad = await api(stu, 'GET', '/api/published?dept=extc&semester=SEM%20III&division=A'); assert.equal(bad.status, 400); assert.match(bad.json.error.message, /no divisions/i)
    // upload + publish an EXTC SEM V timetable without any division
    const fd = new FormData(); for (const [k, v] of Object.entries({ dept_id: 'extc', semester: 'SEM V', academic_year: '2026-27', effective_from: '2026-07-06', status: 'published', title: 'EXTC TE test' })) fd.append(k, v)
    fd.append('file', new Blob(['%PDF-1.4\nextc-test\n%%EOF'], { type: 'application/pdf' }), 'extc.pdf')
    const up = await fetch(base + '/api/admin/versions', { method: 'POST', headers: { 'X-Requested-With': 'tsec-sync', cookie: admin }, body: fd })
    assert.equal(up.status, 201)
    db.prepare("INSERT OR IGNORE INTO users (email,name,role,department,semester,division,password_hash) VALUES ('e1@tsec.edu','E One','student','extc','SEM V','',?),('e2@tsec.edu','E Two','student','extc','SEM V','',?)").run(hashPassword('x'), hashPassword('x'))
    const a = await login('e1@tsec.edu', 'x', 'student'), b = await login('e2@tsec.edu', 'x', 'student')
    const ra = await api(a, 'GET', '/api/published?dept=extc&semester=SEM%20V'), rb = await api(b, 'GET', '/api/published?dept=extc&semester=SEM%20V')
    assert.equal(ra.json.state, 'published'); assert.equal(ra.json.timetable.id, rb.json.timetable.id); assert.equal(ra.json.timetable.division, '')
    // another semester of the same department is a different, separate class
    const vii = (await api(a, 'GET', '/api/published?dept=extc&semester=SEM%20VII')).json.timetable
    assert.equal(vii.sheet.identifier, 'BE-ETC-1'); assert.notEqual(vii.id, ra.json.timetable.id)
    // a division cannot be uploaded for them
    const fd2 = new FormData(); for (const [k, v] of Object.entries({ dept_id: 'chem', semester: 'SEM III', division: 'A', academic_year: '2026-27', effective_from: '2026-07-06' })) fd2.append(k, v)
    fd2.append('file', new Blob(['%PDF-1.4\nchem\n%%EOF'], { type: 'application/pdf' }), 'c.pdf')
    assert.equal((await fetch(base + '/api/admin/versions', { method: 'POST', headers: { 'X-Requested-With': 'tsec-sync', cookie: admin }, body: fd2 })).status, 422)
  })
})

describe('upgrading a database that still has the previous sample accounts', () => {
  test('names/department/semester are refreshed in place; ids, passwords and roles are preserved; role swaps are impossible; EXTC/Chem divisions are cleared', async () => {
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-acc2-'))
    const boot = start(d2); boot.s.close(); const g = boot.db
    const hash = hashPassword('student123')
    g.exec('DELETE FROM users')
    const ins = g.prepare('INSERT INTO users (email,name,role,department,semester,division,password_hash) VALUES (?,?,?,?,?,?,?)')
    ins.run('student@tsec.edu', ['Ananya', 'Mehta'].join(' '), 'student', 'comp', 'SEM III', 'C1', hash)
    ins.run('teacher@tsec.edu', ['Prof.', 'R.', 'Kulkarni'].join(' '), 'teacher', 'comp', null, null, hashPassword('teacher123'))
    ins.run('teacher2@tsec.edu', 'Imposter', 'student', 'it', 'SEM III', 'I1', hashPassword('teacher123')) // wrong role on a demo email
    ins.run('old.extc@tsec.edu', 'Old EXTC', 'student', 'extc', 'SEM III', 'A', hash); ins.run('old.chem@tsec.edu', 'Old Chem', 'student', 'chem', 'SEM V', 'B', hash)
    const idBefore = g.prepare("SELECT id FROM users WHERE email='student@tsec.edu'").get().id
    const second = start(d2)
    try {
      const u = e => second.db.prepare('SELECT * FROM users WHERE email=?').get(e)
      assert.equal(u('student@tsec.edu').name, 'Heeya Shewkani'); assert.equal(u('student@tsec.edu').semester, 'SEM V'); assert.equal(u('student@tsec.edu').id, idBefore)
      assert.equal(u('teacher@tsec.edu').name, 'Dr. Rupali Sarode')
      assert.equal(u('teacher2@tsec.edu').name, 'Imposter', 'an account with a different role is never rewritten into a sample account'); assert.equal(u('teacher2@tsec.edu').role, 'student')
      assert.equal(u('old.extc@tsec.edu').division, ''); assert.equal(u('old.chem@tsec.edu').division, ''); assert.equal(u('old.extc@tsec.edu').name, 'Old EXTC', 'accounts are kept')
      assert.ok(await login('student@tsec.edu', 'student123', 'student', second.b), 'the existing password still works')
      assert.ok(await login('teacher@tsec.edu', 'teacher123', 'teacher', second.b))
      assert.ok(u('student.aids@tsec.edu') && u('student.it@tsec.edu'), 'missing sample accounts are created')
    } finally { second.s.close() }
  })
})

describe('deployment basics', () => {
  test('/api/health is public and reveals nothing but liveness; the .env loader never overrides real environment variables', async () => {
    const r = await fetch(base + '/api/health'); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true })
    const { loadDotEnv } = await import('../config.js')
    const f = path.join(dir, 'x.env'); fs.writeFileSync(f, '# comment\nA_ONE=1\nA_TWO="two words"\nA_KEEP=file\n\nBAD LINE\n')
    const env = { A_KEEP: 'real' }; const loaded = loadDotEnv(f, env)
    assert.deepEqual(env, { A_KEEP: 'real', A_ONE: '1', A_TWO: 'two words' }); assert.deepEqual(loaded.sort(), ['A_ONE', 'A_TWO'])
    assert.deepEqual(loadDotEnv(path.join(dir, 'missing.env'), {}), [])
  })
  test('.env.example documents every environment variable the server reads, and holds no secrets', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const ex = fs.readFileSync(path.join(root, '.env.example'), 'utf8')
    for (const k of ['PORT', 'DATA_DIR', 'NODE_ENV', 'TRUST_PROXY', 'APP_TZ', 'SESSION_HOURS', 'MAX_UPLOAD_MB', 'SEED_DEMO_USERS', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ALLOW_DEMO_RESET']) assert.match(ex, new RegExp(`^#?\\s*${k}=`, 'm'), k)
    assert.match(ex, /^ADMIN_PASSWORD=$/m, 'no password is shipped in the example file')
    assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^\.env$/m)
  })
})
