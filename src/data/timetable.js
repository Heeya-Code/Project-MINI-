// Slot definitions and subject banks used by the seed generator and editors.
// The actual timetable is NOT stored here any more — it lives in the shared
// state (see store/) so teachers, admins and students all read the same data.
export const timeSlots = [
  { id: 1, start: '09:00', end: '10:00' },
  { id: 2, start: '10:00', end: '11:00' },
  { id: 3, start: '11:15', end: '12:15' },
  { id: 4, start: '14:00', end: '15:00' },
]

const T = name => ({ name, roomType: null })
const L = (name, roomType = null) => ({ name, roomType })

// NOTE: IT and AI&DS have no invented demo lectures any more. Their official timetables live in the
// timetable module (server/ + the 'Official Timetable' page); IT is imported from the supplied PDFs.
// 5 theory subjects + 2 practicals per department/semester.
// roomType = preferred room type for practicals (null = ordinary classroom).
export const subjectBanks = {
  comp: {
    'SEM III': [T('Data Structures'), T('Java Programming'), T('Database Management'), T('Discrete Mathematics'), T('Computer Organization'), L('Data Structures Lab', 'Computer Lab'), L('Database Lab', 'Computer Lab')],
    'SEM V': [T('Computer Networks'), T('Operating Systems'), T('Software Engineering'), T('Theory of Computation'), T('Machine Learning'), L('Networks Lab', 'Computer Lab'), L('Operating Systems Lab', 'Computer Lab')],
  },
  extc: {
    'SEM III': [T('Digital Electronics'), T('Signals & Systems'), T('Circuit Theory'), T('Electronic Devices'), T('Engineering Mathematics III'), L('Digital Electronics Lab', 'Electronics Lab'), L('Circuits Lab', 'Electronics Lab')],
    'SEM V': [T('Microprocessors'), T('Communication Systems'), T('Control Systems'), T('Digital Signal Processing'), T('Antenna Theory'), L('Microprocessor Lab', 'Electronics Lab'), L('Communication Lab', 'Electronics Lab')],
  },
  chem: {
    'SEM III': [T('Process Calculations'), T('Fluid Mechanics'), T('Organic Chemistry'), T('Thermodynamics'), T('Material Science'), L('Organic Chemistry Lab'), L('Fluid Mechanics Lab')],
    'SEM V': [T('Chemical Reaction Engineering'), T('Mass Transfer'), T('Heat Transfer'), T('Process Control'), T('Chemical Plant Design'), L('Mass Transfer Lab'), L('Heat Transfer Lab')],
  },
}

// Classes (department + semester + division) that have a seeded timetable.
export const seededClasses = Object.keys(subjectBanks).flatMap(deptId => {
  const divisionsBySemester = deptId === 'comp'
    ? { 'SEM III': ['C1', 'C2', 'C3'], 'SEM V': ['C1', 'C2', 'C3'] }
    : { 'SEM III': [''], 'SEM V': [''] } // EXTC / Chemistry: one class per semester, no division

  return Object.entries(divisionsBySemester).flatMap(([semester, divisions]) =>
    divisions.map(division => ({ deptId, semester, division })))
})
