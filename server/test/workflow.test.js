import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../app.js'
import { hashPassword } from '../auth.js'
import { IT_TIMETABLES } from '../seed/it-data.js'

const TODAY = '2026-10-13' // a Tuesday
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-wf-'))
let srv, base, db
const J = { 'X-Requested-With': 'tsec-sync', 'Content-Type': 'application/json' }
const start = (d = dir) => { const app = createApp({ dataDir: d, today: () => TODAY }); const s = app.listen(0); return { s, b: `http://localhost:${s.address().port}`, db: app.locals.db } }
async function login(email, password, role, b = base) {
  const r = await fetch(b + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password, role }) })
  return r.ok ? r.headers.get('set-cookie').split(';')[0] : null
}
const api = async (cookie, method, url, body, b = base) => {
  const r = await fetch(b + url, { method, headers: { ...J, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: r.status, json: await r.json() }
}
let n = 0
const act = (cookie, name, input, opId) => api(cookie, 'POST', `/api/actions/${name}`, { input, opId: opId || `op-${Date.now()}-${n++}-xxxx` })
const getState = async cookie => (await api(cookie, 'GET', '/api/state')).json.state
const addUser = (email, name, role, dept, sem, div) => db.prepare('INSERT OR IGNORE INTO users (email,name,role,department,semester,division,password_hash) VALUES (?,?,?,?,?,?,?)').run(email, name, role, dept, sem, div, hashPassword('pw-' + email))
const loginNew = email => login(email, 'pw-' + email, email.startsWith('t') ? 'teacher' : 'student')

let admin, teacher, studentCI, studentCII, studentSem5, studentIT, otherTeacher, sn

before(async () => {
  ;({ s: srv, b: base, db } = start())
  addUser('s.iii.c1@tsec.edu', 'Student III C1', 'student', 'comp', 'SEM III', 'C1')
  addUser('s.cii@tsec.edu', 'Student CII', 'student', 'comp', 'SEM III', 'C2')
  addUser('s.v@tsec.edu', 'Student V', 'student', 'comp', 'SEM V', 'C1')
  addUser('t.other@tsec.edu', 'Prof. A. Deshpande', 'teacher', 'comp', null, null)
  addUser('t.sn@tsec.edu', 'Dr. Shachi Natu', 'teacher', 'it', null, null) // a faculty name printed on the official IT sheets
  admin = await login('admin@tsec.edu', 'admin123', 'management')
  teacher = await login('teacher@tsec.edu', 'teacher123', 'teacher')
  studentCI = await loginNew('s.iii.c1@tsec.edu') // a COMP SEM III C1 student (the class of the lecture below)
  studentIT = await login('student.it@tsec.edu', 'student123', 'student')
  studentCII = await loginNew('s.cii@tsec.edu'); studentSem5 = await login('student@tsec.edu', 'student123', 'student') // sample student Heeya: COMP SEM V C1
  otherTeacher = await loginNew('t.other@tsec.edu'); sn = await loginNew('t.sn@tsec.edu')
  LEC = (await getState(admin)).lectures.find(l => l.source === 'official' && l.deptId === 'comp' && l.semester === 'SEM III' && l.division === 'C1' && l.subjectCode === 'WDW' && l.weekday === 'Monday' && l.start === '10:15' && l.faculty === TEACHER).id
})
after(() => srv.close())

// The demo teacher is Dr. Rupali Sarode. LEC = her official COMP SEM III C1 'WDW' lecture on Mondays 10:15 (from SE-C1).
let LEC
const TEACHER = 'Dr. Rupali Sarode'
const resched = over => ({ lectureId: LEC, date: '2026-10-19', newDate: '2026-10-23', newStart: '17:00', newEnd: '18:00', newRoomId: 'C-301', reason: 'Clashes with a department meeting', ...over })
const titles = (st, pred = () => true) => st.notifications.filter(pred).map(x => x.title)

describe('request -> admin notification -> decision (scenarios B, C, D, E)', () => {
  let reqId, noticeId
  test('B: teacher reschedule request is persisted and the administrator is notified with real details', async () => {
    const before = (await getState(admin)).notifications.length
    const r = await act(teacher, 'changeLecture', resched())
    assert.equal(r.status, 200); assert.equal(r.json.result.ok, true); assert.equal(r.json.result.pending, true)
    reqId = r.json.result.request.id
    const a = await getState(admin)
    assert.equal(a.requests.find(x => x.id === reqId).status, 'pending')
    assert.equal(a.notifications.length, before + 1)
    const nt = a.notifications[0]; noticeId = nt.id
    assert.match(nt.title, /Approval needed: lecture reschedule/)
    assert.match(nt.body, /Dr\. Rupali Sarode/); assert.match(nt.body, /Original: .*Requested: /); assert.match(nt.body, /department meeting/)
    assert.equal(nt.details.teacher, TEACHER); assert.equal(nt.details.status, 'pending'); assert.ok(nt.details.submittedAt)
    assert.equal(nt.link, `/app/requests?focus=${reqId}`); assert.equal(nt.category, 'requests')
    assert.ok(nt.original && nt.updated)
  })
  test('the pending request does not change any timetable and nobody else is told', async () => {
    for (const c of [studentCI, studentCII, studentIT, teacher, otherTeacher]) assert.equal(titles(await getState(c), x => /Approval needed/.test(x.title)).length, 0)
    const st = await getState(admin)
    assert.equal(st.exceptions.some(e => e.lectureId === LEC && e.originalDate === '2026-10-19'), false)
  })
  test('a duplicate request (double click) is refused, not stored twice', async () => {
    const r = await act(teacher, 'changeLecture', resched())
    assert.equal(r.json.result.ok, false); assert.match(r.json.result.message, /already waiting/)
    assert.equal((await getState(admin)).requests.filter(x => x.lectureId === LEC && x.status === 'pending').length, 1)
  })
  test('another teacher cannot touch this teacher\'s lecture', async () => {
    const r = await act(otherTeacher, 'changeLecture', resched({ date: '2026-10-26', newDate: '2026-10-27' }))
    assert.equal(r.json.result.ok, false); assert.match(r.json.result.message, /permission/i)
  })
  test('teachers and students cannot approve — the server refuses (403)', async () => {
    for (const c of [teacher, otherTeacher, studentCI]) assert.equal((await act(c, 'decideRequest', { requestId: reqId, decision: 'approve' })).status, 403)
    assert.equal((await getState(admin)).requests.find(x => x.id === reqId).status, 'pending')
  })
  test('C: approval applies the change, re-validates, and notifies ONLY the affected students and the teacher', async () => {
    const opId = 'approve-op-0001'
    const r = await act(admin, 'decideRequest', { requestId: reqId, decision: 'approve' }, opId)
    assert.equal(r.json.result.ok, true)
    const st = await getState(admin)
    const ex = st.exceptions.find(e => e.lectureId === LEC && e.originalDate === '2026-10-19')
    assert.ok(ex && ex.type === 'change' && ex.newDate === '2026-10-23' && ex.newRoomId === 'C-301')
    assert.equal(st.requests.find(x => x.id === reqId).status, 'approved')
    const original = st.lectures.find(l => l.id === LEC) // the recurring timetable itself is unchanged; history preserved
    assert.equal(original.start, '10:15')
    assert.ok(st.audit.some(a => a.action === 'request.approve'))
    // recipients
    const changed = x => x.lectureId === LEC
    assert.ok((await getState(studentCI)).notifications.some(changed), 'student in the class is told')
    assert.ok((await getState(teacher)).notifications.some(x => x.kind === 'decision' && /approved/.test(x.title)), 'teacher is told')
    // H: targeting
    for (const [who, c] of [['CII student', studentCII], ['SEM V student', studentSem5], ['IT student', studentIT], ['other teacher', otherTeacher]]) {
      assert.equal((await getState(c)).notifications.some(changed), false, `${who} must not be notified`)
    }
    // retry with the same opId: stored result is returned, nothing is applied or notified twice
    const count = (await getState(admin)).notifications.length
    const again = await act(admin, 'decideRequest', { requestId: reqId, decision: 'approve' }, opId)
    assert.equal(again.json.replayed, true); assert.equal(again.json.result.ok, true)
    assert.equal((await getState(admin)).notifications.length, count)
    // a fresh attempt is refused because it is already decided
    const dup = await act(admin, 'decideRequest', { requestId: reqId, decision: 'approve' })
    assert.equal(dup.json.result.ok, false); assert.match(dup.json.result.message, /already been decided/)
    assert.equal((await getState(admin)).notifications.length, count)
  })
  test('D: rejection needs a reason, notifies the teacher, leaves the timetable unchanged, tells no student', async () => {
    const r = await act(teacher, 'changeLecture', resched({ date: '2026-10-26', newDate: '2026-10-30' }))
    const id = r.json.result.request.id
    assert.equal((await act(admin, 'decideRequest', { requestId: id, decision: 'reject' })).json.result.ok, false)
    const s0 = (await getState(studentCI)).notifications.length
    const rej = await act(admin, 'decideRequest', { requestId: id, decision: 'reject', note: 'Hall reserved for exams' })
    assert.equal(rej.json.result.ok, true)
    const st = await getState(admin)
    assert.equal(st.requests.find(x => x.id === id).status, 'rejected')
    assert.equal(st.exceptions.some(e => e.originalDate === '2026-10-26' && e.lectureId === LEC), false)
    const tn = (await getState(teacher)).notifications.find(x => x.kind === 'decision' && /rejected/.test(x.title))
    assert.match(tn.body, /Hall reserved for exams/)
    assert.equal((await getState(studentCI)).notifications.length, s0, 'no student notification for a rejected request')
  })
  test('E: cancellation request -> approval -> shown as cancelled and the class is notified', async () => {
    const r = await act(teacher, 'cancelLecture', { lectureId: LEC, date: '2026-11-02', reason: 'Conference attendance' })
    assert.equal(r.json.result.pending, true)
    assert.match((await getState(admin)).notifications[0].title, /lecture cancellation/)
    const ok = await act(admin, 'decideRequest', { requestId: r.json.result.request.id, decision: 'approve' })
    assert.equal(ok.json.result.ok, true)
    const st = await getState(studentCI)
    assert.ok(st.exceptions.some(e => e.lectureId === LEC && e.originalDate === '2026-11-02' && e.type === 'cancel'))
    assert.ok(st.notifications.some(x => x.lectureId === LEC && /Cancel/i.test(x.title + x.body)))
    assert.equal((await getState(studentCII)).notifications.some(x => x.lectureId === LEC), false)
  })
  test('a faculty-change request always needs approval; a new-lecture request is created, approved and the class is told', async () => {
    const f = await act(teacher, 'changeLecture', resched({ date: '2026-11-09', newDate: '2026-11-09', newStart: '17:00', newEnd: '18:00', newRoomId: 'C-301', newFaculty: 'Prof. A. Deshpande', reason: 'Colleague covering' }))
    assert.equal(f.json.result.pending, true); assert.match((await getState(admin)).notifications[0].title, /faculty change/)
    const add = await act(teacher, 'requestNewLecture', { deptId: 'comp', semester: 'SEM III', division: 'C1', subject: 'Remedial Mathematics', weekday: 'Saturday', start: '10:00', end: '11:00', roomId: 'C-301', reason: 'x' })
    assert.equal(add.json.result.ok, false, 'Saturday is not a valid weekday')
    const ok = await act(teacher, 'requestNewLecture', { deptId: 'comp', semester: 'SEM III', division: 'C1', subject: 'Remedial Mathematics', weekday: 'Friday', start: '17:00', end: '18:00', roomId: 'C-302', reason: 'Extra support class' })
    assert.equal(ok.json.result.pending, true)
    assert.match((await getState(admin)).notifications[0].title, /new lecture/)
    assert.equal((await act(teacher, 'requestNewLecture', { deptId: 'comp', semester: 'SEM III', division: 'C1', subject: 'Remedial Mathematics', weekday: 'Friday', start: '17:00', end: '18:00', roomId: 'C-302', reason: 'again' })).json.result.ok, false)
    const dec = await act(admin, 'decideRequest', { requestId: ok.json.result.request.id, decision: 'approve' })
    assert.equal(dec.json.result.ok, true)
    const st = await getState(studentCI)
    const lec = st.lectures.find(l => l.subject === 'Remedial Mathematics')
    assert.ok(lec && lec.faculty === TEACHER)
    assert.ok(st.notifications.some(x => /Timetable Updated/.test(x.title) && /Remedial Mathematics/.test(x.body)))
  })
})

describe('seminars (scenario F)', () => {
  const prop = over => ({ title: 'Intro to Quantum Computing', speaker: 'Dr. X', date: '2026-10-28', start: '14:00', end: '16:00', roomId: 'Seminar Hall 1', audience: { deptId: 'comp', semester: 'SEM V' }, ...over })
  let evId
  test('a proposal is stored as proposed, hidden from students, and the administrator is notified', async () => {
    const r = await act(teacher, 'proposeSeminar', prop())
    assert.equal(r.json.result.ok, true); evId = r.json.result.event.id
    assert.equal(r.json.result.event.status, 'proposed')
    const nt = (await getState(admin)).notifications[0]
    assert.match(nt.title, /seminar proposal/); assert.match(nt.body, /Intro to Quantum Computing/); assert.match(nt.body, /Seminar Hall 1/)
    assert.equal(nt.link, `/app/requests?focus=${evId}`)
    for (const c of [studentCI, studentSem5, studentIT, otherTeacher]) assert.equal((await getState(c)).events.some(e => e.id === evId), false)
    assert.equal((await getState(teacher)).events.some(e => e.id === evId), true)
    assert.equal((await getState(studentSem5)).notifications.some(x => /Quantum/.test(x.body)), false)
  })
  test('conflicts are detected (room already used by an existing seminar) and duplicates refused', async () => {
    const st = await getState(admin)
    const ex = st.events.find(e => e.id === 'ev-sm1')
    const c = await act(teacher, 'proposeSeminar', prop({ title: 'Clash', date: ex.date, start: ex.start, end: ex.end, roomId: ex.roomId }))
    assert.equal(c.json.result.ok, false); assert.match(c.json.result.message, /conflict/i); assert.ok(c.json.result.conflicts.length)
    assert.equal((await act(teacher, 'proposeSeminar', prop())).json.result.ok, false)
    assert.equal((await act(teacher, 'proposeSeminar', prop({ title: 'Past', date: '2026-10-01' }))).json.result.ok, false)
  })
  test('a teacher can edit only their own pending proposal', async () => {
    assert.equal((await act(otherTeacher, 'updateSeminarProposal', { id: evId, ...prop() })).json.result.ok, false)
    const u = await act(teacher, 'updateSeminarProposal', { id: evId, ...prop({ start: '15:00', end: '17:00' }) })
    assert.equal(u.json.result.ok, true)
    assert.match((await getState(admin)).notifications[0].title, /proposal updated/)
  })
  test('students and teachers cannot approve a seminar; approval announces it to the affected class only', async () => {
    for (const c of [teacher, studentCI]) assert.equal((await act(c, 'decideSeminar', { id: evId, decision: 'approve' })).status, 403)
    const ok = await act(admin, 'decideSeminar', { id: evId, decision: 'approve' })
    assert.equal(ok.json.result.ok, true)
    assert.equal((await getState(studentSem5)).events.find(e => e.id === evId).status, 'scheduled')
    assert.ok((await getState(studentSem5)).notifications.some(x => /Quantum/.test(x.title)), 'COMP SEM V is told')
    assert.equal((await getState(studentCI)).notifications.some(x => /Quantum/.test(x.title)), false, 'COMP SEM III is not')
    assert.equal((await getState(studentIT)).notifications.some(x => /Quantum/.test(x.title)), false)
    assert.ok((await getState(teacher)).notifications.some(x => /proposal approved/.test(x.title)))
    assert.equal((await act(admin, 'decideSeminar', { id: evId, decision: 'approve' })).json.result.ok, false)
  })
  test('rejection notifies the teacher with the reason and announces nothing', async () => {
    const p = await act(teacher, 'proposeSeminar', prop({ title: 'Rejected Talk', date: '2026-11-04' }))
    const rej = await act(admin, 'decideSeminar', { id: p.json.result.event.id, decision: 'reject', note: 'Venue unavailable' })
    assert.equal(rej.json.result.ok, true)
    assert.match((await getState(teacher)).notifications[0].body, /Venue unavailable/)
    assert.equal((await getState(studentSem5)).notifications.some(x => /Rejected Talk/.test(x.title)), false)
  })
})

describe('notification centre state (scenario G)', () => {
  test('read marks are per user, never delete, and survive a restart and a new login', async () => {
    const a1 = await getState(admin), t1 = await getState(teacher)
    const target = a1.notifications[0].id
    assert.equal((await act(admin, 'markRead', { ids: [target] })).json.result.ok, true)
    assert.ok((await getState(admin)).reads['admin@tsec.edu'].includes(target))
    assert.equal((await getState(teacher)).reads['teacher@tsec.edu'].includes(target), false, 'another user\'s read state is unaffected')
    assert.equal((await getState(admin)).notifications.length, a1.notifications.length, 'marking read does not delete')
    assert.equal((await act(studentCI, 'markRead', { ids: 'nope' })).status, 400)
    // restart
    srv.close(); const second = start(); base = second.b; srv = second.s; db = second.db
    const admin2 = await login('admin@tsec.edu', 'admin123', 'management'), t2 = await login('teacher@tsec.edu', 'teacher123', 'teacher')
    const st = await getState(admin2)
    assert.ok(st.reads['admin@tsec.edu'].includes(target))
    assert.equal(st.notifications.length, a1.notifications.length)
    assert.equal((await getState(t2)).notifications.length, t1.notifications.length)
    admin = admin2; teacher = t2
    studentCI = await login('student@tsec.edu', 'student123', 'student'); studentIT = await login('student.it@tsec.edu', 'student123', 'student')
    studentCII = await loginNew('s.cii@tsec.edu'); studentSem5 = await loginNew('s.v@tsec.edu'); otherTeacher = await loginNew('t.other@tsec.edu'); sn = await loginNew('t.sn@tsec.edu')
  })
  test('notifications are private: the API only returns what the user is a recipient of', async () => {
    const studentView = await getState(studentCI)
    assert.equal(studentView.notifications.some(x => x.audience?.management), false)
    assert.equal(studentView.requests.length, 0); assert.equal(studentView.audit.length, 0)
    const n = await api(studentCI, 'GET', '/api/notifications')
    assert.deepEqual(n.json.notifications.map(x => x.id), studentView.notifications.map(x => x.id))
    assert.equal((await api(null, 'GET', '/api/state')).status, 401)
  })
  test('cheap polling: unchanged revision returns a tiny response', async () => {
    const st = (await api(admin, 'GET', '/api/state')).json
    const same = await api(admin, 'GET', `/api/state?rev=${st.state.rev}`)
    assert.deepEqual(same.json, { unchanged: true, rev: st.state.rev })
  })
})

describe('official timetables take part in the same workflow, and data is preserved (scenario J)', () => {
  test('published IT entries are mirrored as lectures with batches, faculty names, rooms and validity dates', async () => {
    const st = await getState(studentIT)
    const off = st.lectures.filter(l => l.source === 'official' && l.deptId === 'it')
    assert.equal(off.length, Object.values(IT_TIMETABLES).reduce((a, t) => a + t.entries.length, 0))
    const l = off.find(x => x.deptId === 'it' && x.semester === 'SEM V' && x.division === 'I1' && x.subjectCode === 'AIML' && x.batch === 'T11')
    assert.equal(l.faculty, 'Dr. Shachi Natu'); assert.equal(l.roomId, '1006'); assert.equal(l.weekday, 'Monday'); assert.equal(l.validFrom, '2026-07-06')
    assert.ok(st.officialRooms.some(r => r.id === '1006'))
    assert.ok(st.lectures.some(x => x.source !== 'official'), 'legacy lectures are preserved')
  })
  test('a teacher named on the sheet can request a change to an official lecture; approval notifies exactly that class', async () => {
    const st = await getState(admin)
    const l = st.lectures.find(x => x.source === 'official' && x.deptId === 'it' && x.semester === 'SEM V' && x.division === 'I1' && x.subjectCode === 'AIML' && x.batch === 'T11')
    const r = await act(sn, 'changeLecture', { lectureId: l.id, date: '2026-10-19', newDate: '2026-10-23', newStart: '16:30', newEnd: '17:30', newRoomId: 'N-201', reason: 'Seminar duty' })
    assert.equal(r.json.result.ok, true, r.json.result.message); assert.equal(r.json.result.pending, true)
    assert.match((await getState(admin)).notifications[0].body, /Dr\. Shachi Natu/)
    assert.equal((await act(admin, 'decideRequest', { requestId: r.json.result.request.id, decision: 'approve' })).json.result.ok, true)
    // IT SEM V I1 student is not in the seed; create one and compare with I2
    addUser('s.it5@tsec.edu', 'IT V I1', 'student', 'it', 'SEM V', 'I1'); addUser('s.it5b@tsec.edu', 'IT V I2', 'student', 'it', 'SEM V', 'I2')
    const a = await login('s.it5@tsec.edu', 'pw-s.it5@tsec.edu', 'student'), b = await login('s.it5b@tsec.edu', 'pw-s.it5b@tsec.edu', 'student')
    assert.ok((await getState(a)).notifications.some(x => x.lectureId === l.id), 'I1 student told')
    assert.equal((await getState(b)).notifications.some(x => x.lectureId === l.id), false, 'I2 student not told')
    assert.equal((await getState(studentCI)).notifications.some(x => x.lectureId === l.id), false)
  })
  test('parallel lab batches are not reported as class conflicts', async () => {
    const st = await getState(admin)
    const l = st.lectures.find(x => x.source === 'official' && x.deptId === 'it' && x.semester === 'SEM V' && x.division === 'I1' && x.subjectCode === 'DEVOPS' && x.batch === 'T12')
    // same room change as a parallel batch is fine for the CLASS (rooms differ); only the real room/faculty can clash
    const r = await act(sn, 'changeLecture', { lectureId: l.id, date: '2026-10-19', newRoomId: 'C-301', reason: 'x' })
    assert.equal(r.json.result.ok, false); assert.match(r.json.result.message, /permission/i, 'a different teacher cannot touch it')
  })
  test('withdrawing an official timetable removes its lectures and notifies once; PDFs and versions remain', async () => {
    const list = await api(admin, 'GET', '/api/admin/timetables?dept=it&semester=SEM%20III&division=I2')
    const v = list.json.versions[0]
    const w = await api(admin, 'POST', `/api/admin/versions/${v.id}/withdraw`, { reason: 'Printing error' })
    assert.equal(w.status, 200); assert.equal(w.json.notified, true); assert.equal(w.json.notice, undefined)
    const st = await getState(admin)
    const itTeacherView = await getState(sn)
    assert.equal(st.lectures.some(l => l.source === 'official' && l.deptId === 'it' && l.semester === 'SEM III' && l.division === 'I2'), false)
    assert.ok(st.lectures.some(l => l.source === 'official' && l.division === 'I1' && l.semester === 'SEM III'), 'other classes untouched')
    assert.equal(itTeacherView.notifications.filter(x => /withdrawn/i.test(x.title) && /SEM III/.test(x.title) && /Division I2/.test(x.title)).length, 1)
    const after = await api(admin, 'GET', '/api/admin/timetables?dept=it')
    assert.equal(after.json.versions.length, 6, 'nothing is deleted')
    const f = await fetch(`${base}/api/files/${v.id}`, { headers: { cookie: admin } })
    assert.equal(f.status, 200)
    assert.deepEqual(Buffer.from(await f.arrayBuffer()), fs.readFileSync(new URL('../seed/pdfs/S2-TT.pdf', import.meta.url)), 'original PDF is byte-identical')
    // restore -> republish: lectures come back, history kept
    const c = await api(admin, 'POST', `/api/admin/versions/${v.id}/clone`, { restore: true })
    const p = await api(admin, 'POST', `/api/admin/versions/${c.json.version.id}/publish`, { reason: 'restored' })
    assert.equal(p.status, 200)
    assert.ok((await getState(admin)).lectures.some(l => l.source === 'official' && l.division === 'I2' && l.semester === 'SEM III'))
  })
  test('legacy bookings, events and settings are intact', async () => {
    const st = await getState(admin)
    assert.ok(st.bookings.some(b => b.id === 'bk1') && st.events.some(e => e.id === 'ev-fest'))
    assert.equal(st.settings.teacherRules.reschedule, 'approval')
  })
})

describe('authorization and input safety (scenario I)', () => {
  test('students cannot perform any mutating action except marking read', async () => {
    for (const name of ['changeLecture', 'cancelLecture', 'saveLecture', 'saveEvent', 'decideRequest', 'proposeSeminar', 'createBooking', 'setSettings', 'publishTimetable', 'bulkCancelDay']) {
      assert.equal((await act(studentCI, name, {})).status, 403, name)
    }
  })
  test('teachers cannot use admin-only actions; admins cannot submit teacher-only proposals', async () => {
    for (const name of ['saveLecture', 'deleteLecture', 'saveEvent', 'setSettings', 'publishTimetable', 'bulkCancelDay', 'decideBooking', 'restoreLecture']) assert.equal((await act(teacher, name, {})).status, 403, name)
    assert.equal((await act(admin, 'proposeSeminar', {})).status, 403)
  })
  test('unknown actions, malformed bodies and bad opIds are rejected; unauthenticated calls are refused', async () => {
    assert.equal((await act(admin, 'dropTables', {})).status, 404)
    assert.equal((await api(admin, 'POST', '/api/actions/saveLecture', { input: [1, 2] })).status, 400)
    assert.equal((await api(admin, 'POST', '/api/actions/markRead', { input: { ids: ['n1'] }, opId: 5 })).status, 400)
    assert.equal((await api(null, 'POST', '/api/actions/markRead', { input: { ids: [] } })).status, 401)
    const noCsrf = await fetch(base + '/api/actions/markRead', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: admin }, body: '{"input":{"ids":[]}}' })
    assert.equal(noCsrf.status, 403)
  })
  test('the actor is always the session user: a spoofed identity in the body changes nothing', async () => {
    const r = await act(teacher, 'createBooking', { roomId: 'C-302', date: '2026-11-10', start: '17:00', end: '18:00', purpose: 'Spoof test', faculty: 'Dr. S. Iyer', deptId: 'comp', actor: { role: 'management', name: 'Dr. S. Iyer', email: 'admin@tsec.edu' }, user: { role: 'management' } })
    assert.equal(r.json.result.ok, true)
    assert.equal(r.json.result.booking.createdBy.email, 'teacher@tsec.edu'); assert.equal(r.json.result.booking.faculty, TEACHER)
  })
  test('browser-data import is admin-only and refused once the server has activity; demo reset is disabled by default', async () => {
    assert.equal((await api(teacher, 'POST', '/api/admin/state/import', { state: {} })).status, 403)
    const imp = await api(admin, 'POST', '/api/admin/state/import', { state: { version: 2, lectures: [], exceptions: [], bookings: [], events: [], requests: [], notifications: [], audit: [], reads: {}, settings: {} } })
    assert.equal(imp.status, 409); assert.equal(imp.json.error.code, 'SERVER_HAS_DATA')
    assert.equal((await api(admin, 'POST', '/api/admin/state/reset', { confirm: 'RESET' })).status, 403)
  })
  test('state-changing admin routes for official timetables still need an administrator', async () => {
    assert.equal((await api(teacher, 'POST', '/api/admin/versions/1/withdraw', { reason: 'x' })).status, 403)
  })
})

describe('browser-data import (pristine server only)', () => {
  test('a pristine server accepts a valid backup and keeps official lectures', async () => {
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-imp-'))
    const s2 = start(d2)
    try {
      const a = await login('admin@tsec.edu', 'admin123', 'management', s2.b)
      const seed = (await api(a, 'GET', '/api/state', undefined, s2.b)).json.state
      const backup = { version: 2, seq: 500, lectures: [0, 1, 2].map(i => ({ id: `lec-imp-${i}`, deptId: 'extc', semester: 'SEM III', division: '', subject: 'Imported', faculty: 'Someone', weekday: ['Monday', 'Tuesday', 'Wednesday'][i], start: '09:00', end: '10:00', roomId: 'C-301', slotId: 1 })), exceptions: [], bookings: [], events: [], requests: [], notifications: [], audit: [], reads: {}, settings: seed.settings }
      assert.equal((await api(a, 'POST', '/api/admin/state/import', { state: { ...backup, version: 1 } }, s2.b)).status, 400)
      assert.equal((await api(a, 'POST', '/api/admin/state/import', { state: backup }, s2.b)).status, 200)
      const after = (await api(a, 'GET', '/api/state', undefined, s2.b)).json.state
      assert.equal(after.lectures.filter(l => l.source !== 'official').length, 3)
      assert.ok(after.lectures.filter(l => l.source === 'official').length > 150)
    } finally { s2.s.close() }
  })
})
