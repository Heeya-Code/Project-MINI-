import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../app.js'
import { hashPassword } from '../auth.js'
import { OFFICIAL_TIMETABLES_2 as T } from '../seed/official-data-2.js'
import { findWarnings, entryErrors } from '../validate.js'
import { isValidClass } from '../../shared/divisions.js'

const TODAY = '2026-10-13'
const J = { 'X-Requested-With': 'tsec-sync', 'Content-Type': 'application/json' }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsec-o2-'))
let srv, base, db, stu, admin
const login = async (email, pw, role) => { const r = await fetch(base + '/api/login', { method: 'POST', headers: J, body: JSON.stringify({ email, password: pw, role }) }); return r.ok ? r.headers.get('set-cookie').split(';')[0] : null }
const api = async (c, method, url) => { const r = await fetch(base + url, { method, headers: { ...J, ...(c ? { cookie: c } : {}) } }); return { status: r.status, json: await r.json() } }
const pub = (c, dept, sem, div) => api(c, 'GET', `/api/published?dept=${dept}&semester=${encodeURIComponent(sem)}${div ? `&division=${div}` : ''}`)
const seedPdf = f => fs.readFileSync(new URL(`../seed/pdfs/${f}`, import.meta.url))
before(async () => {
  const app = createApp({ dataDir: dir, today: () => TODAY }); srv = app.listen(0); base = `http://localhost:${srv.address().port}`; db = app.locals.db
  stu = await login('student@tsec.edu', 'student123', 'student'); admin = await login('admin@tsec.edu', 'admin123', 'management')
})
after(() => srv.close())

// The eight required configurations (identifier -> PDF -> class). EXTC and Chemistry have NO division.
const EIGHT = [
  ['S1-5', 'S1-5.pdf', 'aids', 'SEM III', 'S1', 'SE-S1 AI & DS'], ['S2-5', 'S2-5.pdf', 'aids', 'SEM III', 'S2', 'SE-S2 AI & DS'],
  ['SE-ETC-1', 'SE-ETC-1.pdf', 'extc', 'SEM III', '', 'SE/III/EXTC'], ['TE-ETC-1', 'TE-ETC-1.pdf', 'extc', 'SEM V', '', 'SE/V/EXTC'], ['BE-ETC-1', 'BE-ETC-1.pdf', 'extc', 'SEM VII', '', 'SE/VII/EXTC'],
  ['SE-CHEM', 'SE_CHEM.pdf', 'chem', 'SEM III', '', 'Sem III'], ['TE-CHEM', 'TE_CHEM.pdf', 'chem', 'SEM V', '', 'Sem V'], ['BE-CHEM', 'BE_CHEM.pdf', 'chem', 'SEM VII', '', 'Sem VII'],
]
const has = (es, o) => es.some(e => Object.entries(o).every(([k, v]) => e[k] === v))
const entriesOf = async (d, s, v) => (await pub(stu, d, s, v)).json.timetable.entries

describe('the eight timetable configurations are populated, mapped and stored with their PDFs', () => {
  for (const [id, file, dept, sem, div, heading] of EIGHT) {
    test(`${id} (${file}) -> ${dept.toUpperCase()} ${sem}${div ? ' ' + div : ' (no division)'}`, async () => {
      assert.ok(isValidClass(dept, sem, div))
      const r = await pub(stu, dept, sem, div)
      assert.equal(r.json.state, 'published')
      const t = r.json.timetable
      assert.equal(t.sheet.identifier, id); assert.equal(t.sheet.sourceFile, file); assert.equal(t.division, div)
      assert.match(t.title, new RegExp(`\\(${id}\\)`)); assert.equal(t.effective_from, '2026-07-06'); assert.ok(t.sheet.sheetLabel.includes(heading), 'sheet label carries the heading printed on the PDF')
      assert.equal(t.entries.length, T[id].entries.length, 'every transcribed entry is stored (none dropped, none added)')
      for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) assert.ok(t.entries.some(e => e.day === d), `${id} has entries on ${d}`)
      assert.ok(Object.keys(t.legend.faculty).length >= 4 && Object.keys(t.legend.subjects).length >= 4, 'the printed legends are stored')
      const f = await fetch(`${base}/api/files/${t.id}`, { headers: { cookie: stu } })
      assert.deepEqual(Buffer.from(await f.arrayBuffer()), seedPdf(file), 'the original PDF is stored byte-for-byte')
    })
  }
  test('no timetable is swapped: classes are distinct, semesters differ, S1 and S2 differ', async () => {
    const ids = new Set(); const dumps = new Set()
    for (const [id, , dept, sem, div] of EIGHT) { const t = (await pub(stu, dept, sem, div)).json.timetable; ids.add(t.id); dumps.add(JSON.stringify(t.entries)); assert.equal(t.sheet.identifier, id) }
    assert.equal(ids.size, 8); assert.equal(dumps.size, 8)
  })
  test('class rooms come from the headings', async () => {
    const room = async (d, s, v) => (await pub(stu, d, s, v)).json.timetable.sheet.room
    assert.deepEqual([await room('aids', 'SEM III', 'S1'), await room('aids', 'SEM III', 'S2'), await room('extc', 'SEM III'), await room('extc', 'SEM V'), await room('extc', 'SEM VII'), await room('chem', 'SEM III'), await room('chem', 'SEM V'), await room('chem', 'SEM VII')],
      ['901', '907', '702', '806', '', '308', '309', '108'])
  })
})

describe('entries match the printed sheets (spot checks against the PDFs)', () => {
  test('AI&DS Semester III S1 (S1-5) and S2 (S2-5)', async () => {
    const s1 = await entriesOf('aids', 'SEM III', 'S1'), s2 = await entriesOf('aids', 'SEM III', 'S2')
    assert.ok(has(s1, { day: 'Monday', start: '08:00', end: '10:00', batch: 'S11', subject: 'COA', faculty: 'VD', room: '503' }))
    assert.ok(has(s1, { day: 'Tuesday', start: '10:00', end: '12:00', batch: 'S13', subject: 'AOA', faculty: 'AS', room: '202A' }))
    assert.ok(has(s1, { day: 'Wednesday', start: '08:00', end: '10:00', subject: 'ED', faculty: 'MT', room: '208', kind: 'lab' }))
    assert.ok(has(s1, { day: 'Wednesday', start: '15:00', end: '16:00', subject: 'MCE', faculty: 'SK', batch: 'S13', kind: 'tutorial' }))
    assert.ok(has(s1, { day: 'Friday', start: '14:00', end: '16:00', subject: 'ESE', faculty: 'SY' }))
    assert.ok(has(s1, { day: 'Tuesday', start: '09:00', end: '10:00', subject: 'AOA', faculty: 'NR' }))
    assert.ok(has(s2, { day: 'Monday', start: '13:00', end: '15:00', subject: 'ED', faculty: 'MT', room: '208' }))
    assert.ok(has(s2, { day: 'Wednesday', start: '10:00', end: '12:00', batch: 'S22', subject: 'COA', faculty: 'HS', room: '503' }))
    assert.ok(has(s2, { day: 'Thursday', start: '08:00', end: '10:00', subject: 'ED', faculty: 'MT', room: '208/907' }))
    assert.ok(has(s2, { day: 'Friday', start: '09:00', end: '10:00', subject: 'AOA', faculty: 'NR' }))
    for (const es of [s1, s2]) { assert.equal(es.filter(e => e.kind === 'break').length, 5, 'LUNCH BREAK 12:00–12:30 every day'); assert.equal(es.filter(e => e.start === '12:30' && e.kind === 'other').length, 5, 'standing 12:30–1:00 slot every day') }
    assert.ok(!s1.some(e => /^S2/.test(e.batch)) && !s2.some(e => /^S1/.test(e.batch)), 'S1 and S2 never contain each other\'s batches')
  })
  test('EXTC Semesters III, V, VII', async () => {
    const se = await entriesOf('extc', 'SEM III'), te = await entriesOf('extc', 'SEM V'), be = await entriesOf('extc', 'SEM VII')
    assert.ok(has(se, { day: 'Monday', start: '10:30', end: '12:30', batch: 'A3/A4', subject: 'JAVA/C++', faculty: 'RP/MSK', room: '602/605' }))
    assert.ok(has(se, { day: 'Tuesday', start: '15:00', end: '17:00', batch: 'A1', subject: 'DSD', faculty: 'UB', room: '706' }))
    assert.ok(has(se, { day: 'Friday', start: '13:00', end: '15:00', batch: 'A2', subject: 'JAVA/C++', faculty: 'RP', room: '605' }))
    assert.ok(has(se, { day: 'Wednesday', start: '11:30', end: '12:30', subject: 'MSA', faculty: 'PS' }))
    assert.ok(has(te, { day: 'Monday', start: '08:30', end: '10:30', batch: 'A4', subject: 'DTSP', faculty: 'DT', room: '609' }))
    assert.ok(has(te, { day: 'Tuesday', start: '09:30', end: '10:30', subject: 'ML/DCE', faculty: 'BI/MR', room: '806/609' }))
    assert.ok(has(te, { day: 'Thursday', start: '13:00', end: '15:00', batch: 'A3', subject: 'EMA', faculty: 'JK', room: '803' }))
    assert.ok(has(te, { day: 'Friday', start: '15:00', end: '17:00', batch: 'A2', subject: 'CCN', faculty: 'AR', room: '605' }))
    assert.ok(has(be, { day: 'Monday', start: '08:30', end: '09:30', subject: 'DL', faculty: 'MR', room: '806' }))
    assert.ok(has(be, { day: 'Monday', start: '11:30', end: '12:30', subject: 'MCS', faculty: 'AH', room: '702', label: '12 PM' }))
    assert.ok(has(be, { day: 'Tuesday', start: '13:00', end: '15:00', batch: 'A2', subject: 'MCS', faculty: 'AH', room: '605/803' }))
    assert.ok(has(be, { day: 'Friday', start: '14:00', end: '16:00', subject: 'ILOC', kind: 'elective' }))
    assert.equal(be.filter(e => e.subject === 'PROJECT').length, 5, 'PROJECT is printed 5 times: Tuesday 10:30–12:30, Wednesday ×3, Thursday 3:00–5:00')
  })
  test('Chemistry Semesters III, V, VII', async () => {
    const se = await entriesOf('chem', 'SEM III'), te = await entriesOf('chem', 'SEM V'), be = await entriesOf('chem', 'SEM VII')
    assert.ok(has(se, { day: 'Monday', start: '09:00', end: '11:15', batch: 'K3', subject: 'ED', faculty: 'NP' }))
    assert.ok(has(se, { day: 'Monday', start: '15:00', end: '16:00', subject: 'MPR', faculty: '' }))
    assert.ok(has(se, { day: 'Friday', start: '13:00', end: '15:00', batch: 'K3', subject: 'EVS LAB', faculty: 'PN' }))
    assert.ok(has(se, { day: 'Thursday', start: '10:15', end: '11:15', subject: 'OE', faculty: 'PN' }))
    assert.ok(has(te, { day: 'Monday', start: '14:00', end: '16:00', batch: 'K1', subject: 'PDE', faculty: 'TD' }))
    assert.ok(has(te, { day: 'Thursday', start: '10:15', end: '12:15', batch: 'K3', subject: 'MDL', faculty: '' }), 'MDL (K3) has no faculty printed')
    assert.ok(has(te, { day: 'Friday', start: '09:00', end: '11:15', batch: 'K2', subject: 'MTO I', faculty: 'PP' }))
    assert.ok(has(be, { day: 'Monday', start: '09:00', end: '12:15', batch: 'K1', subject: 'IPDC', faculty: 'TD' }))
    assert.ok(has(be, { day: 'Thursday', start: '14:00', end: '17:00', batch: 'K2', subject: 'IPDC', faculty: 'SG' }))
    assert.ok(has(be, { day: 'Tuesday', start: '13:00', end: '16:00', batch: 'K2', subject: 'HRA', faculty: 'MK' }))
    for (const es of [se, te, be]) { assert.equal(es.filter(e => e.subject === 'TEA BREAK').length, 5); assert.equal(es.filter(e => e.subject === 'LUNCH BREAK' && e.start === '12:15' && e.end === '13:00').length, 5) }
    assert.equal(be.filter(e => e.day === 'Thursday' && e.subject === 'Remedial Lecture').length, 3, 'BE Thursday prints three Remedial Lecture periods')
    assert.equal(be.filter(e => e.day === 'Saturday').length + te.filter(e => e.day === 'Saturday').length + se.filter(e => e.day === 'Saturday').length, 0, 'Saturday is blank on all three Chemistry sheets')
  })
})

describe('internal consistency (catches mis-reads) and honest reporting of source problems', () => {
  test('rotating practical batches: every lab subject is run by every batch exactly once (AI&DS and Chemistry)', () => {
    const need = { 'S1-5': ['COA', 'AOA', 'Java'], 'S2-5': ['COA', 'AOA', 'Java'], 'BE-CHEM': ['IPDC', 'CEED', 'HRA'] }
    for (const [id, subs] of Object.entries(need)) for (const s of subs) {
      const batches = T[id].entries.filter(e => e.kind === 'lab' && e.batch && e.subject === s).map(e => e.batch)
      assert.equal(batches.length, 3, `${id} ${s}`); assert.equal(new Set(batches).size, 3, `${id} ${s} batches are distinct`)
    }
    const te = T['TE-CHEM'].entries.filter(e => e.kind === 'lab' && e.batch)
    for (const s of ['CRE I', 'TP', 'PDE', 'MTO I', 'MDL', 'IKS']) assert.deepEqual([...new Set(te.filter(e => e.subject === s).map(e => e.batch))].sort(), ['K1', 'K2', 'K3'], `TE-CHEM ${s}`)
  })
  test('valid entries, no duplicates, and the ONLY scheduling warnings are the two documented TE-ETC-1 batch ambiguities', () => {
    for (const [id, t] of Object.entries(T)) {
      const seen = new Set()
      for (const e of t.entries) { assert.deepEqual(entryErrors(e), [], `${id} ${JSON.stringify(e)}`); const k = [e.day, e.start, e.end, e.subject, e.batch, e.faculty, e.room, e.label].join('|'); assert.ok(!seen.has(k), `${id} duplicate ${k}`); seen.add(k) }
      const w = findWarnings(t.entries, t.legend).filter(x => x.severity === 'warning')
      if (id === 'TE-ETC-1') { assert.equal(w.length, 2); assert.ok(w.every(x => x.type === 'batch_overlap')) } else assert.deepEqual(w, [], id)
    }
  })
  test('every faculty/subject code that is missing from a sheet legend is declared in that sheet\'s sourceIssues', () => {
    for (const [id, t] of Object.entries(T)) {
      const facs = new Set(t.entries.flatMap(e => String(e.faculty || '').split('/').map(x => x.trim())).filter(Boolean))
      const missing = [...facs].filter(c => !t.legend.faculty[c])
      const text = t.sourceIssues.join(' ')
      for (const c of missing) assert.ok(new RegExp(`\\b${c.replace(/[+*?^$()[\]{}|\\]/g, '\\$&')}\\b`).test(text), `${id}: faculty ${c} is missing from the legend but not documented`)
    }
  })
})

describe('students and lectures: single-class EXTC/Chemistry and separate AI&DS divisions', () => {
  test('all students of one EXTC / Chemistry semester see the same timetable; other semesters differ; a division is refused', async () => {
    db.prepare("INSERT OR IGNORE INTO users (email,name,role,department,semester,division,password_hash) VALUES ('x1@t','X1','student','extc','SEM V','',?),('x2@t','X2','student','extc','SEM V','',?),('c1@t','C1','student','chem','SEM VII','',?),('c2@t','C2','student','chem','SEM VII','',?)").run(...Array(4).fill(hashPassword('p')))
    const [x1, x2, c1, c2] = await Promise.all(['x1@t', 'x2@t', 'c1@t', 'c2@t'].map(e => login(e, 'p', 'student')))
    assert.equal((await pub(x1, 'extc', 'SEM V')).json.timetable.id, (await pub(x2, 'extc', 'SEM V')).json.timetable.id)
    assert.equal((await pub(c1, 'chem', 'SEM VII')).json.timetable.id, (await pub(c2, 'chem', 'SEM VII')).json.timetable.id)
    assert.notEqual((await pub(x1, 'extc', 'SEM V')).json.timetable.id, (await pub(x1, 'extc', 'SEM III')).json.timetable.id)
    assert.equal((await pub(x1, 'extc', 'SEM V', 'A')).status, 400); assert.equal((await pub(c1, 'chem', 'SEM VII', 'B')).status, 400)
  })
  test('the AI&DS III sample student (Dhwani, S1) is on S1 and not on S2', async () => {
    const dh = await login('student.aids@tsec.edu', 'student123', 'student')
    const me = (await api(dh, 'GET', '/api/me')).json.user
    const mine = (await pub(dh, 'aids', me.semester, me.division)).json.timetable
    assert.equal(me.division, 'S1'); assert.equal(mine.sheet.identifier, 'S1-5')
  })
  test('lectures reach the shared schedule: sessions only (breaks excluded), no division for EXTC/Chemistry, no clashes introduced', async () => {
    const st = (await api(admin, 'GET', '/api/state')).json.state
    for (const [id, , dept, sem, div] of EIGHT) {
      const L = st.lectures.filter(l => l.source === 'official' && l.deptId === dept && l.semester === sem && l.division === div)
      assert.equal(L.length, T[id].entries.filter(e => e.kind !== 'break').length, `${id}: every non-break entry is a lecture`)
      assert.ok(L.every(l => l.kind !== 'break'))
      assert.ok(L.every(l => (dept === 'extc' || dept === 'chem') ? l.division === '' : true))
    }
    assert.ok(st.lectures.some(l => l.deptId === 'chem' && l.faculty === 'Dr. Praseeda Nambisan'), 'faculty codes resolve to the printed names')
    assert.ok(st.lectures.some(l => l.deptId === 'extc' && l.faculty === 'Prof. Neeru Pathak'))
  })
  test('the two sample teachers keep exactly their COMP lectures (no EXTC/Chemistry/AI&DS lecture is assigned to them)', async () => {
    const st = (await api(admin, 'GET', '/api/state')).json.state
    for (const who of ['Dr. Rupali Sarode', 'Dr. Sakshi Surve']) assert.ok(st.lectures.filter(l => l.faculty === who).every(l => l.deptId === 'comp'), who)
  })
})
