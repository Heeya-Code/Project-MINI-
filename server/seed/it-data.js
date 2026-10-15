// Transcription of the six official IT timetables (scanned PDFs, W.E.F. 06.07.2026).
// RULES: nothing here is invented. Where the sheet is ambiguous or looks wrong, the entry is kept
// AS PRINTED and the problem is recorded in `sourceIssues` so an administrator can decide.
// Times are 24h. Where a sheet prints an explicit range such as "(1 to 2)" that range is used;
// otherwise the grid column is used (1:30-2:30 -> 13:30-14:30).
//
// File identifier -> (semester, division) mapping required by the brief. IT divisions are I1 / I2.
export const IT_MAPPING = {
  S1: { semester: 'SEM III', division: 'I1' }, S2: { semester: 'SEM III', division: 'I2' },
  T1: { semester: 'SEM V', division: 'I1' }, T2: { semester: 'SEM V', division: 'I2' },
  B1: { semester: 'SEM VII', division: 'I1' }, B2: { semester: 'SEM VII', division: 'I2' },
}

const D = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }
// row(day, 'HH:MM', 'HH:MM', subject, faculty, room, extra)
const row = (day, start, end, subject, faculty, room, x = {}) => ({
  day: D[day], start, end, kind: x.kind || 'lecture', subject, faculty: faculty || '', room: room || '',
  batch: x.batch || '', label: x.label || '', note: x.note || '',
})
const lab = (day, start, end, subject, batch, faculty, room, x = {}) => row(day, start, end, subject, faculty, room, { ...x, kind: 'lab', batch })
const el = (day, start, end, subject, faculty, room, label) => row(day, start, end, subject, faculty, room, { kind: 'elective', label })
const tut = (day, start, end, subject) => row(day, start, end, subject, '', '', { kind: 'tutorial', label: '(T)' })

// ---------------------------------------------------------------- S1  IT / SEM III / I1
const S1 = [
  row('Mon', '09:30', '10:30', 'AMT', 'GM'),
  lab('Mon', '10:30', '12:30', 'SQL', 'S11', 'RM', '1004'), lab('Mon', '10:30', '12:30', 'ADSA', 'S12', 'KS', '1003'), lab('Mon', '10:30', '12:30', 'FSJ', 'S13', 'AD', '1004'),
  row('Mon', '13:30', '14:30', 'DMSA', 'RM'), row('Mon', '14:30', '15:30', 'FSJ', 'AD'), tut('Mon', '15:30', '16:30', 'AMT'),
  row('Tue', '09:30', '10:30', 'WDW', 'JM'), row('Tue', '10:30', '11:30', 'ES', 'ABM'), row('Tue', '11:30', '12:30', 'ADSA', 'KS'),
  row('Tue', '13:30', '14:30', 'ED', 'AM'),
  lab('Tue', '14:30', '16:30', 'ED', 'S11', 'AM', '1003'), lab('Tue', '14:30', '16:30', 'SQL', 'S12', 'RM', '1004'), lab('Tue', '14:30', '16:30', 'ADSA', 'S13', 'KS', '1003'),
  row('Wed', '09:30', '10:30', 'DMSA', 'RM'),
  lab('Wed', '10:30', '12:30', 'ADSA', 'S11', 'KS', '1003'), lab('Wed', '10:30', '12:30', 'FSJ', 'S12', 'NJ', '1004'), lab('Wed', '10:30', '12:30', 'ED', 'S13', 'AM', '1003'),
  row('Wed', '13:30', '14:30', 'AT', 'AK'), row('Wed', '14:30', '15:30', 'ADSA', 'KS'), row('Wed', '15:30', '16:30', 'WDW', 'JM'), tut('Wed', '16:30', '17:30', 'AMT'),
  row('Thu', '09:30', '10:30', 'DMSA', 'RM'), row('Thu', '10:30', '11:30', 'ES', 'ABM'), row('Thu', '11:30', '12:30', 'AT', 'AK'),
  row('Thu', '13:30', '14:30', 'ADSA', 'KS'), lab('Thu', '14:30', '16:30', 'ES Lab', '', 'ABM', '1003'), tut('Thu', '16:30', '17:30', 'AMT'),
  row('Fri', '09:30', '10:30', 'AMT', 'GM'),
  lab('Fri', '10:30', '12:30', 'FSJ', 'S11', 'NJ', '1004'), lab('Fri', '10:30', '12:30', 'ED', 'S12', 'AM', '1003'),
  // AS PRINTED: batch "S11" (the rotation suggests S13) — see sourceIssues.
  lab('Fri', '10:30', '12:30', 'SQL', 'S11', 'RM', '1004', { note: 'Printed as S11 on the source sheet' }),
  row('Fri', '13:30', '14:30', 'ED', 'AM'), row('Fri', '14:30', '15:30', 'FSJ', 'AD'), row('Fri', '15:30', '16:30', 'AT', 'AK'),
]

// ---------------------------------------------------------------- S2  IT / SEM III / I2
const S2 = [
  row('Mon', '09:30', '10:30', 'WDW', 'JM', '1103'), row('Mon', '10:30', '11:30', 'AT', 'NJ', '1001'), row('Mon', '11:30', '12:30', 'ADSA', 'AK', '1001'),
  row('Mon', '13:30', '14:30', 'ED', 'AM', '1104'),
  lab('Mon', '14:30', '16:30', 'ADSA', 'S21', 'AK', '1003'), lab('Mon', '14:30', '16:30', 'ED', 'S22', 'AM', '1003'),
  lab('Mon', '14:30', '16:30', 'SQL', 'S23', '', '1004', { note: 'No faculty printed on the source sheet' }),
  row('Tue', '09:30', '10:30', 'AMT', 'GM', '1104'),
  lab('Tue', '10:30', '12:30', 'SQL', 'S21', 'RM', '1004'), lab('Tue', '10:30', '12:30', 'FSJ', 'S22', 'AD', '1004'), lab('Tue', '10:30', '12:30', 'ADSA', 'S23', 'AK', '1003'),
  row('Tue', '13:30', '14:30', 'AT', 'NJ', '1104'), row('Tue', '14:30', '15:30', 'FSJ', 'AD', '1001'), row('Tue', '15:30', '16:30', 'ADSA', 'AK', '1001'), tut('Tue', '16:30', '17:30', 'AMT'),
  row('Wed', '09:30', '10:30', 'AT', 'NJ', '1104'), row('Wed', '10:30', '11:30', 'DMSA', 'RM', '1001'), row('Wed', '11:30', '12:30', 'ADSA', 'AK', '1001'),
  row('Wed', '13:30', '14:30', 'ES', 'ABM', '1104'),
  lab('Wed', '14:30', '16:30', 'FSJ', 'S21', 'AD', '1004'), lab('Wed', '14:30', '16:30', 'ADSA', 'S22', 'AK', '1003'), lab('Wed', '14:30', '16:30', 'ED', 'S23', 'AM', '1003'),
  row('Thu', '09:30', '10:30', 'AMT', 'GM', '1104'),
  lab('Thu', '10:30', '12:30', 'ED', 'S21', 'AM', '1003'), lab('Thu', '10:30', '12:30', 'SQL', 'S22', 'RM', '1004'), lab('Thu', '10:30', '12:30', 'FSJ', 'S23', 'AD', '1004'),
  row('Thu', '13:30', '14:30', 'ED', 'AM', '1103'), row('Thu', '14:30', '15:30', 'DMSA', 'RM', '1103'), tut('Thu', '15:30', '16:30', 'AMT'),
  row('Fri', '09:30', '10:30', 'DMSA', 'RM', '1104'), row('Fri', '10:30', '11:30', 'WDW', 'JM', '1001'), row('Fri', '11:30', '12:30', 'FSJ', 'AD', '1001'),
  row('Fri', '13:30', '14:30', 'ES', 'ABM', '1104'), lab('Fri', '14:30', '16:30', 'ES Lab', '', 'ABM', '1003'), tut('Fri', '16:30', '17:30', 'AMT'),
]

// ---------------------------------------------------------------- T1  IT / SEM V / I1  (Room 1101; Wednesday post-lunch starts 1:00 pm)
const T1 = [
  row('Mon', '09:30', '10:30', 'CS', 'MI'),
  lab('Mon', '10:30', '12:30', 'AIML', 'T11', 'SN', '1006'), lab('Mon', '10:30', '12:30', 'DEVOPS', 'T12', 'GK', '1002'), lab('Mon', '10:30', '12:30', 'CS', 'T13', 'MI', '1006'),
  row('Mon', '13:30', '14:30', 'WT', 'SR'), row('Mon', '14:30', '15:30', 'SEAP', 'CA'), row('Mon', '15:30', '16:30', 'IKS', 'ABM'),
  row('Tue', '09:30', '10:30', 'AIML', 'SN'), row('Tue', '10:30', '11:30', 'CS', 'MI'), row('Tue', '11:30', '12:30', 'WT', 'SR'),
  row('Tue', '13:30', '14:30', 'WMC', 'GK'),
  lab('Tue', '14:30', '16:30', 'WMC', 'T11', 'NH', '906'), lab('Tue', '14:30', '16:30', 'WEB LAB', 'T12', 'SR', '1006'), lab('Tue', '14:30', '16:30', 'DEVOPS', 'T13', 'GK', '1002'),
  row('Wed', '09:30', '10:30', 'CDS', 'MI'),
  lab('Wed', '10:30', '12:30', 'CS', 'T11', 'MI', '1006'), lab('Wed', '10:30', '12:30', 'AIML', 'T12', 'SN', '1006'), lab('Wed', '10:30', '12:30', 'WMC', 'T13', 'GK', '906'),
  row('Wed', '13:00', '14:00', 'WMC', 'GK', '', { label: '(1 to 2)' }), row('Wed', '14:00', '15:00', 'WT', 'SR', '', { label: '(2 to 3)' }),
  row('Wed', '15:00', '17:00', 'IKS LAB', 'ABM', '', { kind: 'lab', label: '(3 to 5)' }),
  row('Thu', '09:30', '10:30', 'AIML', 'SN'), row('Thu', '10:30', '11:30', 'SEAP', 'CA'), row('Thu', '11:30', '12:30', 'CS', 'MI'),
  row('Thu', '13:30', '14:30', 'IKS', 'ABM'),
  lab('Thu', '14:30', '16:30', 'DEVOPS', 'T11', 'GK', '1002'), lab('Thu', '14:30', '16:30', 'CS', 'T12', 'MI', '1006'), lab('Thu', '14:30', '16:30', 'WEB LAB', 'T13', 'SR', '1006'),
  row('Fri', '09:30', '10:30', 'AIML', 'SN'),
  lab('Fri', '10:30', '12:30', 'WEB LAB', 'T11', 'SR', '1006'), lab('Fri', '10:30', '12:30', 'WMC', 'T12', 'GK', '906'), lab('Fri', '10:30', '12:30', 'AIML', 'T13', 'SN', '1006'),
  row('Fri', '13:30', '14:30', 'WMC', 'GK'), row('Fri', '14:30', '15:30', 'CDS', 'MI'), row('Fri', '15:30', '16:30', 'SEAP', 'CA'),
]

// ---------------------------------------------------------------- T2  IT / SEM V / I2  (Room 1102; Tuesday post-lunch starts 1:00 pm)
const T2 = [
  row('Mon', '09:30', '10:30', 'WMC', 'GK'), row('Mon', '10:30', '11:30', 'SEAP', 'SKP'), row('Mon', '11:30', '12:30', 'AIML', 'GP'),
  row('Mon', '13:30', '14:30', 'IKS', 'ABM'),
  lab('Mon', '14:30', '16:30', 'ADT', 'T21', 'ST', '1006'), lab('Mon', '14:30', '16:30', 'AIML', 'T22', 'GP', '1005'), lab('Mon', '14:30', '16:30', 'WEB LAB', 'T23', 'SR', '1006'),
  row('Tue', '09:30', '10:30', 'CDS', 'MI'),
  lab('Tue', '10:30', '12:30', 'WMC', 'T21', 'NH', '906'), lab('Tue', '10:30', '12:30', 'DEVOPS', 'T22', 'SG', '1002'), lab('Tue', '10:30', '12:30', 'ADT', 'T23', 'ST', '1006'),
  row('Tue', '13:00', '14:00', 'IKS', 'ABM', '', { label: '(1 to 2)' }), row('Tue', '14:00', '15:00', 'SEAP', 'SKP', '', { label: '(2 to 3)' }),
  row('Tue', '15:00', '17:00', 'IKS LAB', 'ABM', '', { kind: 'lab', label: '(3 to 5)' }),
  row('Wed', '09:30', '10:30', 'WMC', 'GK'), row('Wed', '10:30', '11:30', 'WT', 'SR'), row('Wed', '11:30', '12:30', 'AIML', 'GP'),
  row('Wed', '13:30', '14:30', 'ADT', 'ST'),
  lab('Wed', '14:30', '16:30', 'AIML', 'T21', 'GP', '1006'), lab('Wed', '14:30', '16:30', 'WMC', 'T22', 'NH', '906'), lab('Wed', '14:30', '16:30', 'DEVOPS', 'T23', 'SG', '1002'),
  row('Thu', '09:30', '10:30', 'AIML', 'GP'),
  lab('Thu', '10:30', '12:30', 'DEVOPS', 'T21', 'SG', '1002'), lab('Thu', '10:30', '12:30', 'WEB LAB', 'T22', 'SR', '1006'), lab('Thu', '10:30', '12:30', 'AIML', 'T23', 'GP', '1006'),
  row('Thu', '13:30', '14:30', 'WT', 'SR'), row('Thu', '14:30', '15:30', 'ADT', 'ST'), row('Thu', '15:30', '16:30', 'SEAP', 'SKP'),
  row('Fri', '09:30', '10:30', 'CDS', 'MI'), row('Fri', '10:30', '11:30', 'WMC', 'GK'), row('Fri', '11:30', '12:30', 'ADT', 'ST'),
  row('Fri', '13:30', '14:30', 'WT', 'SR'),
  lab('Fri', '14:30', '16:30', 'WEB LAB', 'T21', 'SR', '1006'), lab('Fri', '14:30', '16:30', 'ADT', 'T22', 'ST', '1006'), lab('Fri', '14:30', '16:30', 'WMC', 'T23', 'GK', '1005'),
]

// ---------------------------------------------------------------- B1  IT / SEM VII / I1  (Room 1103; Mon & Fri post-lunch start 1:00 pm)
const ELECTIVE_MON_B1 = [el('Mon', '15:00', '16:30', 'MIS', 'NJ', '1104', '(3 to 4.30)'), el('Mon', '15:00', '16:30', 'CSL', 'MI', '1102', '(3 to 4.30)'), el('Mon', '15:00', '16:30', 'OR', 'PS', '1103', '(3 to 4.30)'), el('Mon', '15:00', '16:30', 'PLM', 'PN', 'OB 308', '(3 to 4.30)')]
const B1 = [
  lab('Mon', '10:30', '12:30', 'IOE', 'B11', 'JM', '1005'), lab('Mon', '10:30', '12:30', 'IOE', 'B12', 'NH', '1005'), lab('Mon', '10:30', '12:30', 'SAD', 'B13', 'CA', '906'),
  row('Mon', '13:00', '14:00', 'IRS', 'ST', '', { label: '(1 to 2)' }), row('Mon', '14:00', '15:00', 'IS', 'NH', '', { label: '(2 to 3)' }),
  ...ELECTIVE_MON_B1,
  row('Tue', '10:30', '11:30', 'AIDS2', 'SN'), row('Tue', '11:30', '12:30', 'AIDS2', 'SN'),
  row('Tue', '13:30', '14:30', 'IOE', 'GP'), row('Tue', '14:30', '15:30', 'IOE', 'GP'),
  lab('Wed', '10:30', '12:30', 'ROSP', 'B11', 'SKP', '1005'), lab('Wed', '10:30', '12:30', 'DS', 'B12', 'SG', '906'), lab('Wed', '10:30', '12:30', 'IOE', 'B13', 'JM', '1005'),
  row('Wed', '13:30', '14:30', 'IOE', 'GP'), row('Wed', '14:30', '15:30', 'IRS', 'ST'),
  row('Thu', '10:30', '11:30', 'AIDS2', 'SN'), row('Thu', '11:30', '12:30', 'IRS', 'ST'),
  lab('Thu', '13:30', '15:30', 'DS', 'B11', 'AK', '906'), lab('Thu', '13:30', '15:30', 'SAD', 'B12', 'CA', '1005'), lab('Thu', '13:30', '15:30', 'ROSP', 'B13', 'SKP', '1005'),
  row('Thu', '15:30', '17:00', 'MIS', 'NJ', '1104', { label: '(3.30 to 5)' }),
  lab('Fri', '10:30', '12:30', 'SAD', 'B11', 'CA', '1005'), lab('Fri', '10:30', '12:30', 'ROSP', 'B12', 'SKP', '1005'), lab('Fri', '10:30', '12:30', 'DS', 'B13', 'KS', '906'),
  row('Fri', '13:00', '14:00', 'IS', 'NH', '', { label: '(1 to 2)' }), row('Fri', '14:00', '15:00', 'IS', 'NH', '', { label: '(2 to 3)' }),
  el('Fri', '15:00', '16:30', 'CSL', 'GP', '1102', '(3 to 4.30)'), el('Fri', '15:00', '16:30', 'OR', 'PS', '1103', '(3 to 4.30)'), el('Fri', '15:00', '16:30', 'PLM', 'PN', 'OB 308', '(3 to 4.30)'),
]

// ---------------------------------------------------------------- B2  IT / SEM VII / I2  (Room 1104; Mon & Fri post-lunch start 1:00 pm)
const B2 = [
  row('Mon', '09:30', '10:30', 'AIDS2', 'SN'), row('Mon', '10:30', '11:30', 'IOE', 'GP'), row('Mon', '11:30', '12:30', 'IRS', 'ST'),
  lab('Mon', '13:00', '15:00', 'DS', 'B21', 'KS', '906', { label: '(1 to 3)' }), lab('Mon', '13:00', '15:00', 'IOE', 'B22', 'JM', '1005', { label: '(1 to 3)' }), lab('Mon', '13:00', '15:00', 'ROSP', 'B23', 'SKP', '1005', { label: '(1 to 3)' }),
  el('Mon', '15:00', '16:30', 'MIS', 'NJ', '1103', '(3 to 4.30)'), el('Mon', '15:00', '16:30', 'CSL', 'MI', '1104', '(3 to 4.30)'), el('Mon', '15:00', '16:30', 'OR', 'PS', '1102', '(3 to 4.30)'), el('Mon', '15:00', '16:30', 'PLM', 'PN', 'OB308', '(3 to 4.30)'),
  lab('Tue', '10:30', '12:30', 'SAD LAB', 'B23', 'CA', '1005'), lab('Tue', '10:30', '12:30', 'ROSP LAB', 'B22', 'SKP', '1005'),
  row('Tue', '13:30', '14:30', 'IRS', 'ST'), row('Tue', '14:30', '15:30', 'IRS', 'ST'),
  row('Wed', '09:30', '10:30', 'AIDS2', 'SN'), row('Wed', '10:30', '11:30', 'IS', 'NH'), row('Wed', '11:30', '12:30', 'IS', 'NH'),
  lab('Wed', '13:30', '15:30', 'SAD', 'B22', 'CA', '1005'), lab('Wed', '13:30', '15:30', 'IOE', 'B23', 'AV', '1005'),
  // AS PRINTED: both ROSP B21 and IOE B21 are in the same slot — see sourceIssues.
  lab('Thu', '10:30', '12:30', 'ROSP', 'B21', 'SKP', '1005'), lab('Thu', '10:30', '12:30', 'IOE', 'B21', 'NH', '1005'),
  row('Thu', '13:30', '14:30', 'AIDS2', 'SN'), row('Thu', '14:30', '15:30', 'IS', 'NH'), row('Thu', '15:30', '17:00', 'MIS', 'NJ', '1104', { label: '(3.30 to 5)' }),
  row('Fri', '10:30', '11:30', 'IOE', 'GP'), row('Fri', '11:30', '12:30', 'IOE', 'GP'),
  // AS PRINTED: "DS B22" appears twice (KS and AK) — see sourceIssues.
  lab('Fri', '13:00', '15:00', 'SAD', 'B21', 'CA', '1005', { label: '(1 to 3)' }), lab('Fri', '13:00', '15:00', 'DS', 'B22', 'KS', '906', { label: '(1 to 3)' }), lab('Fri', '13:00', '15:00', 'DS', 'B22', 'AK', '906', { label: '(1 to 3)' }),
  el('Fri', '15:00', '16:30', 'CSL', 'GP', '1102', '(3 to 4.30)'), el('Fri', '15:00', '16:30', 'OR', 'PS', '1103', '(3 to 4.30)'), el('Fri', '15:00', '16:30', 'PLM', 'PN', 'OB 308', '(3 to 4.30)'),
]

// Legends are stored EXACTLY as printed (typos included). Codes used on a sheet but missing from
// its legend are listed in sourceIssues, not guessed.
const FAC_S = { NJ: 'Dr. Nikhilesh Joshi', AD: 'Dr. Arti Deshpande', AM: 'Dr. Anjali Malviya', KS: 'Dr. Kmkum Saxena', AK: 'Archana Kale', RM: 'Reshma Malik', ABM: 'Anuradha Mistry', AV: 'Ajay Vishwakarma', GM: 'Gaurav Mittal' }
const SUB_S = { 'AMT': 'AMT-I: Applied Mathematics Thinking-I', ADSA: 'Advanced Data Structure Analysis', DMSA: 'Database Management System & Application', AT: 'Automata Theory', ED: 'Enterprrenueship Development', ES: 'Environmental Science', FSJ: 'Full Stack Java Programming' }
const SUB_T = { AIML: 'Artificial Intelligence  & Machine Learning', CS: 'Cyber Security', ADT: 'Advanced Database Technologies', WMC: 'Wireless & Mobile Communication', CDS: 'Cyber & Digital Safety', WT: 'Wweb Technology', IKS: 'Indian Knowledge System' }
const FAC_T1 = { MI: 'Dr. Mukesh Israni', SN: 'Dr. Shachi Natu', GK: 'Geeta Karande', SR: 'Sunita Rathod', CA: 'Chetan Agarwal', NH: 'Dr. Nagaveni Hebbar', ABM: 'Anuradha Mistry' }
const FAC_T2 = { MI: 'Dr. Mukesh Israni', GP: 'Dr. Gopal Pardesi', GK: 'Geeta Karande', SR: 'Sunita Rathod', SKP: 'Dr. SanjayKumar Pandey', NH: 'Dr. Nagaveni Hebbar', ST: 'Dr. Shanthi Therese', ABM: 'Anuradha Mistry' }
const FAC_B = { MI: 'Dr. Mukesh Israni', SN: 'Dr. Shachi Natu', GP: 'Dr. Gopal Pardesi', ST: 'Dr. Shanthi Therese', NH: 'Dr. Nagaveni Hebbar', SKP: 'Dr. Sanjay Pandey', CA: 'Prof. Chetan Agarwal', NJ: 'Dr. Nikhilesh Joshi', PN: 'Dr. Praseeda Nambiasan', PS: 'Dr. Poonam Soni' }
const SUB_B = { AIDS2: 'Arrtificial Intelligence & Data Science 2', IOE: 'Internet of Everything', IRS: 'Information Retrieval Systeem', IS: 'Infrastructure Security', CSL: 'Cyber Security &', MIS: 'Management Information System', OR: 'Operation Research', PLM: 'Prodct LifeCycle Mamagement', SAD: 'Secure Application Development Lab', ROSP: 'Recent Open Sorce Project Lab' }

const common = { effectiveFrom: '2026-07-06', header: 'Thadomal Shahani Engineering College — Department of Information Technology — Time Table' }

export const IT_TIMETABLES = {
  S1: { ...common, ...IT_MAPPING.S1, sheetLabel: 'Class : S1', room: '', entries: S1, legend: { faculty: FAC_S, subjects: SUB_S },
    sheetNotes: [],
    sourceIssues: ['Friday 10:30–12:30: "SQL S11 RM 1004" shares batch S11 with "FSJ S11 NJ 1004". Every other S1 batch rotates cleanly, so S13 was probably intended. Kept as printed.', 'Faculty code JM is used (WDW) but is not in the sheet legend.', 'Subject codes WDW and SQL are used but are not in the sheet legend.', 'Tutorial blocks "AMT (T)" print no faculty or room.'] },
  S2: { ...common, ...IT_MAPPING.S2, sheetLabel: 'Class : S2', room: '', entries: S2, legend: { faculty: FAC_S, subjects: SUB_S },
    sheetNotes: [],
    sourceIssues: ['Monday 14:30–16:30: "SQL S23 1004" prints no faculty.', 'Faculty code JM is used (WDW) but is not in the sheet legend.', 'Subject codes WDW and SQL are used but are not in the sheet legend.', 'Tutorial blocks "AMT (T)" print no faculty or room.'] },
  T1: { ...common, ...IT_MAPPING.T1, sheetLabel: 'Room : 1101', room: '1101', entries: T1, legend: { faculty: FAC_T1, subjects: SUB_T },
    sheetNotes: ['Wednesday Lecture/Lab after Lunch Break will start at 1:00 pm'],
    sourceIssues: ['Subject codes SEAP, DEVOPS and WEB LAB are used but are not in the sheet legend; ADT is listed but not used.'] },
  T2: { ...common, ...IT_MAPPING.T2, sheetLabel: 'Room : 1102', room: '1102', entries: T2, legend: { faculty: FAC_T2, subjects: SUB_T },
    sheetNotes: ['Tuesday Lecture/Lab after Lunch Break will start at 1:00 pm'],
    sourceIssues: ['Faculty code SG (DEVOPS) is used but is not in the sheet legend.', 'Subject codes SEAP, DEVOPS and WEB LAB are used but are not in the sheet legend; CS is listed but not used.'] },
  B1: { ...common, ...IT_MAPPING.B1, sheetLabel: 'Room : 1103', room: '1103', entries: B1, legend: { faculty: FAC_B, subjects: SUB_B },
    sheetNotes: ['Monday and Friday Lecture/Lab after Lunch Break will start at 1:00 pm'],
    sourceIssues: ['Faculty codes JM, SG, AK and KS are used but are not in the sheet legend.', 'Subject code DS is used (lab) but is not in the sheet legend.', 'Legend entry "CSL: Cyber Security &" is cut off on the sheet.'] },
  B2: { ...common, ...IT_MAPPING.B2, sheetLabel: 'Room : 1104', room: '1104', entries: B2, legend: { faculty: FAC_B, subjects: SUB_B },
    sheetNotes: ['Monday and Friday Lecture/Lab after Lunch Break will start at 1:00 pm'],
    sourceIssues: ['Thursday 10:30–12:30: "ROSP B21 SKP 1005" and "IOE B21 NH 1005" are both for batch B21 in the same slot. Kept as printed.', 'Friday 13:00–15:00: "DS B22" is printed twice (KS and AK); one is probably B23. Kept as printed.', 'Faculty codes JM, KS, AK and AV are used but are not in the sheet legend.', 'Subject code DS is used (lab) but is not in the sheet legend.', 'Tuesday lab block lists only B22 and B23; no B21 entry is printed.'] },
}
