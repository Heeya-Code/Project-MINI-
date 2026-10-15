// Single source of truth for departments / semesters / divisions.
// Imported by BOTH the React app and the Express server so they can never disagree.
// Division names are DEPARTMENT-SPECIFIC values:
//   * AI&DS uses S1 and S2 as real division labels (S3 was removed).
//   * IT uses I1, I2 (the IT timetable files are *named* S1/S2/T1/T2/B1/B2, but those are
//     file identifiers, not division names; see server/seed/it-data.js for the mapping).
export const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Engineering', short: 'COMP' },
  { id: 'it', name: 'Information Technology', short: 'IT' },
  { id: 'aids', name: 'AI & Data Science', short: 'AIDS' },
  { id: 'extc', name: 'Electronics & Telecommunication', short: 'EXTC' },
  { id: 'chem', name: 'Chemical Engineering', short: 'CHEM' },
]
// ACTIVE semesters only. Semesters I, II, IV, VI (and VIII) are retired: they are not offered anywhere,
// every API rejects them, and obsolete data for them is archived (never deleted) by server/retire.js.
export const SEMESTERS = ['SEM III', 'SEM V', 'SEM VII']

// Active divisions per department (the same for every active semester).
//   AI&DS: S1, S2  (S3 was removed from every semester)
//   IT:    I1, I2  (the IT sheet files are *named* S1/S2/T1/T2/B1/B2 — file identifiers, not divisions)
//   COMP:  C1, C2, C3  (as printed on the SE/TE/BE sheets; renamed from CI/CII/CIII)
//   EXTC, Chemistry: NO divisions — one class per semester. Their class key uses the empty division ''.
const DIVISIONS = {
  comp: ['C1', 'C2', 'C3'],
  it: ['I1', 'I2'],
  aids: ['S1', 'S2'],
  extc: [],
  chem: [],
}

// Does this department have divisions at all? (EXTC and Chemistry do not.)
export const hasDivisions = deptId => (DIVISIONS[deptId]?.length ?? 0) > 0

// divisionOptionsFor('aids', 'SEM V') -> ['S1','S2'].   A retired semester has NO divisions: [].
// Without a semester it returns every active division of the department.
export function divisionOptionsFor(deptId, semester) {
  if (deptId === 'all') return ['all']
  const list = DIVISIONS[deptId]
  if (!list) return []
  if (semester && semester !== 'all') return SEMESTERS.includes(semester) ? [...list] : []
  return [...list]
}

// A department WITH divisions needs one of them; a department WITHOUT divisions (EXTC, Chemistry) must have none.
export const isValidClass = (deptId, semester, division) =>
  DEPARTMENTS.some(d => d.id === deptId) && SEMESTERS.includes(semester) &&
  (hasDivisions(deptId) ? DIVISIONS[deptId].includes(division) : !division)

export const departmentName = id => DEPARTMENTS.find(d => d.id === id)?.name || id
export const departmentShort = id => DEPARTMENTS.find(d => d.id === id)?.short || id
