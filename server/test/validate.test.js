import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findWarnings, entryErrors } from '../validate.js'

const e = (o) => ({ day: 'Monday', start: '10:00', end: '11:00', kind: 'lecture', subject: 'X', faculty: 'A', room: '1', batch: '', ...o })
test('back-to-back sessions are fine', () => assert.equal(findWarnings([e({}), e({ start: '11:00', end: '12:00', subject: 'Y', faculty: 'B' })]).filter(w => w.severity === 'warning').length, 0))
test('same batch twice is flagged', () => assert.equal(findWarnings([e({ batch: 'B1' }), e({ batch: 'B1', subject: 'Y', faculty: 'B' })])[0].type, 'batch_overlap'))
test('different batches in parallel are legitimate', () => assert.equal(findWarnings([e({ batch: 'B1' }), e({ batch: 'B2', subject: 'Y', faculty: 'B' })]).filter(w => w.severity === 'warning').length, 0))
test('parallel electives are legitimate', () => assert.equal(findWarnings([e({ kind: 'elective' }), e({ kind: 'elective', subject: 'Y', faculty: 'B' })]).filter(w => w.severity === 'warning').length, 0))
test('same faculty in two parallel batches is flagged', () => assert.ok(findWarnings([e({ batch: 'B1' }), e({ batch: 'B2', subject: 'Y' })]).some(w => w.type === 'faculty_overlap')))
test('joint class (same subject, room, faculty) is not a faculty clash', () => assert.ok(!findWarnings([e({ batch: 'B1' }), e({ batch: 'B2' })]).some(w => w.type === 'faculty_overlap')))
test('entry errors', () => { assert.ok(entryErrors({ day: 'Monday', start: '11:00', end: '10:00', subject: 'X' }).length); assert.equal(entryErrors(e({})).length, 0) })
