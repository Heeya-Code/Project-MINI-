// Department / semester / division configuration lives in /shared/divisions.js so the
// server and the UI use exactly the same rules. This file keeps the old import paths working.
import { DEPARTMENTS, SEMESTERS, divisionOptionsFor as sharedOptions, hasDivisions as sharedHasDivisions } from '../../shared/divisions.js'

export const departments = DEPARTMENTS
export const semesters = SEMESTERS
export const divisions = ['A', 'B']
// divisionOptionsFor(deptId, semester?) — semester is optional for old call sites.
export const divisionOptionsFor = (deptId, semester) => sharedOptions(deptId, semester)
export const hasDivisions = deptId => deptId !== 'all' && sharedHasDivisions(deptId)
export const defaultDivisionFor = (deptId, semester) => deptId === 'all' || !sharedHasDivisions(deptId) ? 'all' : divisionOptionsFor(deptId, semester)[0]
const YEARS = { 'SEM III': 'SE', 'SEM V': 'TE', 'SEM VII': 'BE' }
export const yearOfSemester = sem => YEARS[sem] || ''
export const academicYears = ['SE', 'TE', 'BE']
export const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export { isValidClass } from '../../shared/divisions.js'
