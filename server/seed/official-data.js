// Transcription of the supplied official timetables for COMPUTER ENGINEERING (SE/TE/BE) and AI&DS (TE/BE).
// RULES: nothing is invented. Entries are exactly what is printed on the sheet; anything ambiguous or
// suspicious is recorded in `sourceIssues` and left as printed. Times are 24h.
//
// COMP sheets (SE-C*, TE-C*, BE-C*): periods 9:15-10:15, 10:15-11:15, 11:15-12:15, [lunch], 1:00-2:00, 2:00-3:00,
//   3:00-4:00, 4:00-5:00. A lab batch is printed as "batch+subject | faculty" over TWO periods (a 2-hour block).
//   "MIS" is printed with "(4:30 PM)" in the 4-5 column, i.e. 3:00-4:30.
// AI&DS sheets (T1-5, T2-5, B1-5, B2-5): periods 9-10, 10-11, 11-12, [lunch 12:00-12:30], 12:30-1:00 (a standing
//   "Content Beyond Syllabus / Mentorship Meeting / Remedial Lecture" slot), 1-2, 2-3, 3-4, 4-5.
const D = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }
const e = (day, start, end, subject, faculty, room, x = {}) => ({ day: D[day], start, end, kind: x.kind || 'lecture', subject, faculty: faculty || '', room: room || '', batch: x.batch || '', label: x.label || '', note: x.note || '' })
const lec = (day, s, t, subject, fac, room, x) => e(day, s, t, subject, fac, room, x)
const other = (day, s, t, subject, room) => e(day, s, t, subject, '', room, { kind: 'other' })
// n consecutive one-hour cells with the same content (printed as separate cells)
const addH = (t, n) => { const [h, m] = t.split(':').map(Number); return `${String(h + n).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
const hrs = (day, s, n, subject, fac, room, kind = 'lecture') => Array.from({ length: n }, (_, i) => e(day, addH(s, i), addH(s, i + 1), subject, fac, room, { kind }))
// parallel lab batches over one two-hour block: [[batch, subject, faculty], ...]
const labs = (day, s, t, rows, room = '') => rows.map(([b, subj, fac]) => e(day, s, t, subj, fac, room, { kind: 'lab', batch: b }))
const prj = (day, s, t, batch) => e(day, s, t, 'PR', '', '', { kind: 'lab', batch })
const mis = (day, room) => e(day, '15:00', '16:30', 'MIS', 'AK/SV', room, { label: '(4:30 PM)' })
const std = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat' }
const A = 'AK/SV'

// ------------------------------------------------------------------ COMP SEM VII (BE)
const BE_C1 = [
  other('Mon', '09:15', '10:15', 'MENTOR MEETING'), ...labs('Mon', '10:15', '12:15', [['C11', 'NLP', 'VP'], ['C12', 'BC', 'AP'], ['C13', 'BDA', 'NJ']]),
  lec('Mon', '13:00', '14:00', 'ML', 'TS', '305'), lec('Mon', '14:00', '15:00', 'NLP', 'VP', '305'), mis('Mon', '305'),
  other('Tue', '09:15', '10:15', 'REMEDIAL LECTURE', '305'), lec('Tue', '10:15', '11:15', 'NLP', 'VP', '305'), lec('Tue', '11:15', '12:15', 'ML', 'TS', '305'),
  ...labs('Tue', '13:00', '15:00', [['C13', 'ML', 'TS'], ['C12', 'NLP', 'VP'], ['C11', 'BDA', 'SJ']]), prj('Tue', '15:00', '17:00', 'C11'),
  other('Wed', '09:15', '10:15', 'MENTOR MEETING'), other('Wed', '10:15', '11:15', 'REMEDIAL LECTURE', '305'), lec('Wed', '11:15', '12:15', 'BDA', 'SJ', '305'),
  lec('Wed', '13:00', '14:00', 'ML', 'TS', '305'), lec('Wed', '14:00', '15:00', 'BC', 'AP', '305'), ...labs('Wed', '15:00', '17:00', [['C12', 'ML', 'TS'], ['C11', 'BC', 'AP'], ['C13', 'NLP', 'VP']]),
  other('Thu', '09:15', '10:15', 'MENTOR MEETING'), ...labs('Thu', '10:15', '12:15', [['C11', 'ML', 'TS'], ['C13', 'BC', 'AP'], ['C12', 'BDA', 'SJ']]),
  lec('Thu', '13:00', '14:00', 'BC', 'AP', '305'), lec('Thu', '14:00', '15:00', 'BDA', 'SJ', '305'), prj('Thu', '15:00', '17:00', 'C12'),
  prj('Fri', '09:15', '11:15', 'C13'), lec('Fri', '11:15', '12:15', 'NLP', 'VP', '305'), lec('Fri', '13:00', '14:00', 'BC', 'AP', '305'), lec('Fri', '14:00', '15:00', 'BDA', 'SJ', '305'), mis('Fri', '305'),
  other('Sat', '09:15', '10:15', 'REMEDIAL LECTURE', '305'), prj('Sat', '10:15', '11:15', 'C11'), prj('Sat', '10:15', '11:15', 'C13'), prj('Sat', '11:15', '12:15', 'C12'),
  prj('Sat', '13:00', '14:00', 'C11'), prj('Sat', '13:00', '14:00', 'C13'), prj('Sat', '14:00', '15:00', 'C12'), prj('Sat', '15:00', '16:00', 'C11'), prj('Sat', '15:00', '16:00', 'C13'), prj('Sat', '16:00', '17:00', 'C12'),
]
const BE_C2 = [
  other('Mon', '09:15', '10:15', 'REMEDIAL LECTURE'), lec('Mon', '10:15', '11:15', 'NLP', 'UB', '305'), lec('Mon', '11:15', '12:15', 'ML', 'DK', '305'),
  ...labs('Mon', '13:00', '15:00', [['C21', 'ML', 'DK'], ['C22', 'NLP', 'UB'], ['C23', 'BC', 'AC']]), mis('Mon', '404'),
  other('Tue', '09:15', '10:15', 'MENTOR MEETING'), ...labs('Tue', '10:15', '12:15', [['C23', 'BDA', 'NJ'], ['C22', 'BC', 'AC'], ['C21', 'NLP', 'UB']]),
  lec('Tue', '13:00', '14:00', 'BC', 'AC', '305'), lec('Tue', '14:00', '15:00', 'BDA', 'NJ', '305'), prj('Tue', '15:00', '17:00', 'C21'),
  other('Wed', '09:15', '10:15', 'REMEDIAL LECTURE', '404'), lec('Wed', '10:15', '11:15', 'ML', 'DK', '404'), lec('Wed', '11:15', '12:15', 'NLP', 'UB', '404'),
  ...labs('Wed', '13:00', '15:00', [['C22', 'ML', 'DK'], ['C21', 'BDA', 'ASD'], ['C23', 'NLP', 'UB']]), prj('Wed', '15:00', '17:00', 'C22'),
  other('Thu', '09:15', '10:15', 'MENTOR MEETING'), lec('Thu', '10:15', '11:15', 'BDA', 'NJ', '305'), lec('Thu', '11:15', '12:15', 'ML', 'DK', '305'),
  lec('Thu', '13:00', '14:00', 'NLP', 'UB', '404'), lec('Thu', '14:00', '15:00', 'BC', 'AC', '404'), prj('Thu', '15:00', '17:00', 'C23'),
  other('Fri', '09:15', '10:15', 'REMEDIAL LECTURE'), lec('Fri', '10:15', '11:15', 'BC', 'AC', '404'), lec('Fri', '11:15', '12:15', 'BDA', 'NJ', '404'),
  ...labs('Fri', '13:00', '15:00', [['C23', 'ML', 'DK'], ['C22', 'BDA', 'NJ'], ['C21', 'BC', 'AC']]), mis('Fri', '404'),
  other('Sat', '09:15', '10:15', 'MENTOR MEETING'), prj('Sat', '10:15', '11:15', 'C21'), prj('Sat', '10:15', '11:15', 'C23'), prj('Sat', '11:15', '12:15', 'C22'),
  prj('Sat', '13:00', '14:00', 'C21'), prj('Sat', '13:00', '14:00', 'C23'), prj('Sat', '14:00', '15:00', 'C22'), prj('Sat', '15:00', '16:00', 'C21'), prj('Sat', '15:00', '16:00', 'C23'), prj('Sat', '16:00', '17:00', 'C22'),
]
const BE_C3 = [
  prj('Mon', '09:15', '11:15', 'C32'), lec('Mon', '11:15', '12:15', 'ML', 'VS', '404'), lec('Mon', '13:00', '14:00', 'BDA', 'ASD', '404'), lec('Mon', '14:00', '15:00', 'BC', 'JJ', '404'), mis('Mon', '404'),
  other('Tue', '09:15', '10:15', 'MENTOR MEETING'), other('Tue', '10:15', '11:15', 'REMEDIAL LECTURE', '404'), lec('Tue', '11:15', '12:15', 'NLP', 'JG', '404'),
  lec('Tue', '13:00', '14:00', 'ML', 'VS', '404'), lec('Tue', '14:00', '15:00', 'BC', 'JJ', '404'), ...labs('Tue', '15:00', '17:00', [['C31', 'NLP', 'JG'], ['C32', 'BC', 'JJ'], ['C33', 'BDA', 'ASD']]),
  other('Wed', '09:15', '10:15', 'MENTOR MEETING'), ...labs('Wed', '10:15', '12:15', [['C31', 'ML', 'VS'], ['C32', 'BDA', 'ASD'], ['C33', 'NLP', 'JG']]),
  lec('Wed', '13:00', '14:00', 'BC', 'JJ', '404'), lec('Wed', '14:00', '15:00', 'ML', 'VS', '404'), prj('Wed', '15:00', '17:00', 'C33'),
  other('Thu', '09:15', '10:15', 'REMEDIAL LECTURE', '404'), lec('Thu', '10:15', '11:15', 'NLP', 'JG', '404'), lec('Thu', '11:15', '12:15', 'BDA', 'ASD', '404'),
  ...labs('Thu', '13:00', '15:00', [['C32', 'NLP', 'JG'], ['C31', 'BC', 'JJ'], ['C33', 'ML', 'VS']]), prj('Thu', '15:00', '17:00', 'C31'),
  other('Fri', '09:15', '10:15', 'REMEDIAL LECTURE'), ...labs('Fri', '10:15', '12:15', [['C33', 'BC', 'AP'], ['C31', 'BDA', 'ASD'], ['C32', 'ML', 'VS']]),
  lec('Fri', '13:00', '14:00', 'NLP', 'JG', '404'), lec('Fri', '14:00', '15:00', 'BDA', 'ASD', '404'), mis('Fri', '404'),
  other('Sat', '09:15', '10:15', 'MENTOR MEETING'), prj('Sat', '10:15', '11:15', 'C31'), prj('Sat', '10:15', '11:15', 'C33'), prj('Sat', '11:15', '12:15', 'C32'),
  prj('Sat', '13:00', '14:00', 'C31'), prj('Sat', '13:00', '14:00', 'C33'), prj('Sat', '14:00', '15:00', 'C32'), prj('Sat', '15:00', '16:00', 'C31'), prj('Sat', '15:00', '16:00', 'C33'), prj('Sat', '16:00', '17:00', 'C32'),
]
// ------------------------------------------------------------------ COMP SEM III (SE)
const SE_C1 = [
  other('Mon', '09:15', '10:15', 'REMEDIAL LECTURE'), lec('Mon', '10:15', '11:15', 'WDW', 'RS'), lec('Mon', '11:15', '12:15', 'AOA', 'KI'),
  lec('Mon', '13:00', '14:00', 'EM', 'SK1'), lec('Mon', '14:00', '15:00', 'EM', 'SK1'), lec('Mon', '15:00', '16:00', 'DSGT', 'SK'),
  lec('Tue', '09:15', '10:15', 'FJP', 'VA'), lec('Tue', '10:15', '11:15', 'COA', 'RK'), lec('Tue', '11:15', '12:15', 'AOA', 'KI'),
  ...labs('Tue', '13:00', '15:00', [['C13', 'FJP', 'VA'], ['C12', 'AOA', 'KI'], ['C14', 'COA', 'RK'], ['C11', 'FJP', 'SMS']]), ...hrs('Tue', '15:00', 2, 'ED(P)', 'SV', '', 'lab'),
  lec('Wed', '09:15', '10:15', 'FJP', 'VA'), lec('Wed', '10:15', '11:15', 'DSGT', 'SK'), lec('Wed', '11:15', '12:15', 'AOA', 'KI'),
  lec('Wed', '13:00', '14:00', 'EVS', 'GS'), lec('Wed', '14:00', '15:00', 'EVS', 'GS'), ...hrs('Wed', '15:00', 2, 'ED', 'SV'),
  other('Thu', '09:15', '10:15', 'MENTOR MEETING'), lec('Thu', '10:15', '11:15', 'DSGT', 'SK'), lec('Thu', '11:15', '12:15', 'WDW', 'RS'),
  lec('Thu', '13:00', '14:00', 'COA', 'RK'), lec('Thu', '14:00', '15:00', 'EM', 'SK1'), ...labs('Thu', '15:00', '17:00', [['C13', 'AOA', 'DK'], ['C14', 'AOA', 'KI'], ['C11', 'COA', 'RK'], ['C12', 'COA', 'GS']]),
  ...hrs('Fri', '09:15', 2, 'EVS(P)', 'GS', '', 'lab'), lec('Fri', '11:15', '12:15', 'COA', 'RK'),
  ...labs('Fri', '13:00', '15:00', [['C14', 'FJP', 'VA'], ['C11', 'AOA', 'KI'], ['C13', 'COA', 'RK'], ['C12', 'FJP', 'RS']]), other('Fri', '15:00', '17:00', 'MENTOR MEETING'),
  other('Sat', '10:15', '12:15', 'REMEDIAL LECTURE'), other('Sat', '13:00', '14:00', 'MENTOR MEETING'),
]
const SE_C2 = [
  other('Mon', '09:15', '10:15', 'MENTOR MEETING'), lec('Mon', '10:15', '11:15', 'COA', 'GS'), lec('Mon', '11:15', '12:15', 'FJP', 'SMS'),
  ...labs('Mon', '13:00', '15:00', [['C21', 'AOA', 'KI'], ['C22', 'AOA', 'SSS'], ['C23', 'COA', 'GS'], ['C24', 'FJP', 'SMS']]), ...hrs('Mon', '15:00', 2, 'ED', 'KA'),
  other('Tue', '09:15', '10:15', 'REMEDIAL LECTURE'), lec('Tue', '10:15', '11:15', 'COA', 'GS'), lec('Tue', '11:15', '12:15', 'FJP', 'SMS'),
  lec('Tue', '13:00', '14:00', 'WDW', 'SI'), lec('Tue', '14:00', '15:00', 'DSGT', 'BJ'), ...hrs('Tue', '15:00', 2, 'ED(P)', 'KA', '', 'lab'),
  lec('Wed', '09:15', '10:15', 'COA', 'GS'), ...labs('Wed', '10:15', '12:15', [['C22', 'COA', 'GS'], ['C23', 'AOA', 'SSS'], ['C21', 'FJP', 'VA'], ['C24', 'COA', 'RK']]),
  lec('Wed', '13:00', '14:00', 'EM', 'MK'), lec('Wed', '14:00', '15:00', 'AOA', 'SSS'), ...hrs('Wed', '15:00', 2, 'EVS(P)', 'RK', '', 'lab'),
  lec('Thu', '09:15', '10:15', 'DSGT', 'BJ'), lec('Thu', '10:15', '11:15', 'WDW', 'SI'), lec('Thu', '11:15', '12:15', 'AOA', 'SSS'),
  ...labs('Thu', '13:00', '15:00', [['C22', 'FJP', 'SMS'], ['C21', 'COA', 'GS'], ['C24', 'AOA', 'VA'], ['C23', 'FJP', 'RS']]), other('Thu', '15:00', '17:00', 'MENTOR MEETING'),
  other('Fri', '09:15', '10:15', 'REMEDIAL LECTURE'), lec('Fri', '10:15', '11:15', 'AOA', 'SSS'), lec('Fri', '11:15', '12:15', 'DSGT', 'BJ'),
  lec('Fri', '13:00', '14:00', 'EM', 'MK'), lec('Fri', '14:00', '15:00', 'EM', 'MK'), ...hrs('Fri', '15:00', 2, 'EVS', 'RK'),
  other('Sat', '10:15', '11:15', 'REMEDIAL LECTURE'), other('Sat', '11:15', '12:15', 'MENTOR MEETING'),
]
const SE_C3 = [
  other('Mon', '09:15', '10:15', 'MENTOR MEETING'), lec('Mon', '10:15', '11:15', 'ED(P)', 'BJ', '', { kind: 'lab' }), lec('Mon', '11:15', '12:15', 'COA', 'TM'),
  lec('Mon', '13:00', '14:00', 'FJP', 'RS'), lec('Mon', '14:00', '15:00', 'EM', 'MK'),
  ...labs('Mon', '15:00', '17:00', [['C31', 'COA', 'RK'], ['C32', 'COA', 'TM'], ['C33', 'AOA', 'SSS'], ['C34', 'FJP', 'SMS']]),
  lec('Tue', '09:15', '10:15', 'DSGT', 'KI'), lec('Tue', '10:15', '11:15', 'COA', 'TM'), lec('Tue', '11:15', '12:15', 'AOA', 'DK'),
  lec('Tue', '13:00', '14:00', 'EM', 'MK'), lec('Tue', '14:00', '15:00', 'EM', 'MK'), lec('Tue', '15:00', '16:00', 'ED(P)', 'BJ', '', { kind: 'lab' }), other('Tue', '16:00', '17:00', 'REMEDIAL LECTURE'),
  lec('Wed', '09:15', '10:15', 'DSGT', 'KI'), lec('Wed', '10:15', '11:15', 'WDW', 'SMS'), lec('Wed', '11:15', '12:15', 'FJP', 'RS'),
  ...labs('Wed', '13:00', '15:00', [['C31', 'AOA', 'VA'], ['C34', 'COA', 'NS'], ['C32', 'AOA', 'KI'], ['C33', 'FJP', 'RS']]),
  lec('Wed', '15:00', '16:00', 'EVS(P)', 'ASD', '', { kind: 'lab' }), other('Wed', '16:00', '17:00', 'MENTOR MEETING'),
  other('Thu', '09:15', '10:15', 'REMEDIAL LECTURE'), lec('Thu', '10:15', '11:15', 'WDW', 'SMS'), lec('Thu', '11:15', '12:15', 'DSGT', 'KI'),
  lec('Thu', '13:00', '14:00', 'COA', 'TM'), lec('Thu', '14:00', '15:00', 'AOA', 'DK'), ...hrs('Thu', '15:00', 2, 'EVS', 'ASD'),
  lec('Fri', '09:15', '10:15', 'AOA', 'DK'), ...labs('Fri', '10:15', '12:15', [['C31', 'FJP', 'SMS'], ['C33', 'COA', 'TM'], ['C34', 'AOA', 'DK'], ['C32', 'FJP', 'RS']]),
  lec('Fri', '13:00', '14:00', 'ED', 'BJ'), lec('Fri', '14:00', '15:00', 'ED', 'BJ'), lec('Fri', '15:00', '16:00', 'EVS(P)', 'ASD', '', { kind: 'lab' }),
  other('Sat', '09:15', '10:15', 'REMEDIAL LECTURE'), other('Sat', '10:15', '12:15', 'MENTOR MEETING'),
]
// ------------------------------------------------------------------ COMP SEM V (TE)
const TE_C1 = [
  lec('Mon', '09:15', '10:15', 'CN', 'SI', '504'), lec('Mon', '10:15', '11:15', 'AISC', 'SK', '504'), lec('Mon', '11:15', '12:15', 'DWM', 'SSS', '504'),
  ...labs('Mon', '13:00', '15:00', [['C11', 'AISC', 'SK'], ['C12', 'CN', 'SI'], ['C13', 'WMC', 'PJ'], ['C14', 'SE', 'KA']]), other('Mon', '15:00', '16:00', 'REMEDIAL LECTURE', '504'), other('Mon', '16:00', '17:00', 'MENTOR MEETING'),
  lec('Tue', '09:15', '10:15', 'CN', 'SI', '508'), ...labs('Tue', '10:15', '12:15', [['C11', 'CN', 'SI'], ['C12', 'DWM', 'SSS'], ['C13', 'AISC', 'SK'], ['C14', 'WMC', 'PJ']]),
  lec('Tue', '13:00', '14:00', 'SE', 'KA', '504'), lec('Tue', '14:00', '15:00', 'IKS', 'NS', '504'), lec('Tue', '15:00', '16:00', 'DWM', 'SSS', '504'), other('Tue', '16:00', '17:00', 'REMEDIAL LECTURE', '504'),
  lec('Wed', '09:15', '10:15', 'CN', 'SI', '504'), lec('Wed', '10:15', '11:15', 'CDS', 'MD', '504'), lec('Wed', '11:15', '12:15', 'WMC', 'PJ', '504'),
  ...labs('Wed', '13:00', '15:00', [['C11', 'WMC', 'PJ'], ['C12', 'AISC', 'SK'], ['C13', 'SE', 'KA'], ['C14', 'CN', 'SI']]), ...hrs('Wed', '15:00', 2, 'IKS(P)', 'NS', '504', 'lab'),
  lec('Thu', '09:15', '10:15', 'IKS', 'NS', '504'), lec('Thu', '10:15', '11:15', 'WMC', 'PJ', '504'), lec('Thu', '11:15', '12:15', 'CDS', 'MD', '504'),
  lec('Thu', '13:00', '14:00', 'AISC', 'SK', '504'), lec('Thu', '14:00', '15:00', 'SE', 'KA', '504'),
  ...labs('Thu', '15:00', '17:00', [['C11', 'DWM', 'AC'], ['C13', 'DWM', 'SSS'], ['C12', 'SE', 'KA'], ['C14', 'DWM', 'MD']]),
  lec('Fri', '09:15', '10:15', 'WMC', 'PJ', '404'), ...labs('Fri', '10:15', '12:15', [['C11', 'SE', 'KA'], ['C14', 'AISC', 'SK'], ['C13', 'CN', 'SI'], ['C12', 'WMC', 'PJ']]),
  lec('Fri', '13:00', '14:00', 'DWM', 'SSS', '504'), lec('Fri', '14:00', '15:00', 'AISC', 'SK', '504'), lec('Fri', '15:00', '16:00', 'SE', 'KA', '504'), other('Fri', '16:00', '17:00', 'MENTOR MEETING'),
  other('Sat', '11:15', '12:15', 'REMEDIAL LECTURE', '504'), other('Sat', '13:00', '14:00', 'MENTOR MEETING'),
]
const TE_C2 = [
  ...hrs('Mon', '09:15', 2, 'IKS', 'VA', '508'), lec('Mon', '11:15', '12:15', 'SE', 'PJ', '508'), lec('Mon', '13:00', '14:00', 'WMC', 'AK', '504'), lec('Mon', '14:00', '15:00', 'AISC', 'VS', '504'),
  ...labs('Mon', '15:00', '17:00', [['C21', 'AISC', 'BJ'], ['C22', 'AISC', 'VS'], ['C23', 'SE', 'PJ'], ['C24', 'WMC', 'SJ']]),
  lec('Tue', '09:15', '10:15', 'DWM', 'UB', '504'), lec('Tue', '10:15', '11:15', 'AISC', 'VS', '504'), lec('Tue', '11:15', '12:15', 'CDS', 'BJ', '504'),
  lec('Tue', '13:00', '14:00', 'CN', 'TM', '508'), lec('Tue', '14:00', '15:00', 'SE', 'PJ', '508'), ...labs('Tue', '15:00', '17:00', [['C21', 'WMC', 'AK'], ['C22', 'DWM', 'MD'], ['C23', 'WMC', 'SJ'], ['C24', 'DWM', 'NS']]),
  lec('Wed', '09:15', '10:15', 'DWM', 'UB', '305'), ...labs('Wed', '10:15', '12:15', [['C21', 'SE', 'KA'], ['C22', 'CN', 'SI'], ['C24', 'CN', 'TM'], ['C23', 'AISC', 'BJ']]),
  lec('Wed', '13:00', '14:00', 'CN', 'TM', '504'), lec('Wed', '14:00', '15:00', 'WMC', 'AK', '504'), lec('Wed', '15:00', '16:00', 'SE', 'PJ', '508'), other('Wed', '16:00', '17:00', 'MENTOR MEETING'),
  lec('Thu', '09:15', '10:15', 'DWM', 'UB', '508'), lec('Thu', '10:15', '11:15', 'CN', 'TM', '508'), lec('Thu', '11:15', '12:15', 'AISC', 'VS', '508'),
  ...labs('Thu', '13:00', '15:00', [['C24', 'SE', 'SV'], ['C21', 'DWM', 'MD'], ['C23', 'CN', 'SI'], ['C22', 'WMC', 'AK']]), lec('Thu', '15:00', '16:00', 'CDS', 'BJ', '504'), other('Thu', '16:00', '17:00', 'MENTOR MEETING'),
  ...hrs('Fri', '09:15', 2, 'IKS(P)', 'VA', '504', 'lab'), lec('Fri', '11:15', '12:15', 'WMC', 'AK', '504'),
  ...labs('Fri', '13:00', '15:00', [['C22', 'SE', 'SV'], ['C24', 'AISC', 'VS'], ['C21', 'CN', 'TM'], ['C23', 'DWM', 'UB']]), other('Fri', '15:00', '16:00', 'REMEDIAL LECTURE', '508'),
  other('Sat', '11:15', '12:15', 'REMEDIAL LECTURE', '508'), other('Sat', '13:00', '14:00', 'REMEDIAL LECTURE', '508'), other('Sat', '14:00', '15:00', 'MENTOR MEETING'),
]
const TE_C3 = [
  lec('Mon', '09:15', '10:15', 'CDS', 'AC', '305'), ...labs('Mon', '10:15', '12:15', [['C31', 'WMC', 'AK'], ['C32', 'SE', 'JG'], ['C33', 'DWM', 'JJ'], ['C34', 'DWM', 'AC']]),
  lec('Mon', '13:00', '14:00', 'WMC', 'SJ', '508'), lec('Mon', '14:00', '15:00', 'IKS', 'AP', '508'), lec('Mon', '15:00', '16:00', 'IKS', 'AP', '508'), other('Mon', '16:00', '17:00', 'REMEDIAL LECTURE', '508'),
  other('Tue', '09:15', '10:15', 'MENTOR MEETING'), lec('Tue', '10:15', '11:15', 'SE', 'NS', '508'), lec('Tue', '11:15', '12:15', 'DWM', 'JJ', '508'),
  ...labs('Tue', '13:00', '15:00', [['C31', 'SE', 'SV'], ['C33', 'SE', 'JG'], ['C34', 'WMC', 'AK'], ['C32', 'CN', 'RS']]), ...hrs('Tue', '15:00', 2, 'IKS(P)', 'AP', '508', 'lab'),
  lec('Wed', '09:15', '10:15', 'SE', 'JG', '508'), lec('Wed', '10:15', '11:15', 'CDS', 'AC', '508'), lec('Wed', '11:15', '12:15', 'AISC', 'TS', '508'),
  lec('Wed', '13:00', '14:00', 'CN', 'VP', '508'), lec('Wed', '14:00', '15:00', 'WMC', 'SJ', '508'), ...labs('Wed', '15:00', '17:00', [['C32', 'WMC', 'AK'], ['C33', 'WMC', 'SJ'], ['C34', 'CN', 'RS'], ['C31', 'AISC', 'BJ']]),
  other('Thu', '09:15', '10:15', 'REMEDIAL LECTURE', '305'), ...labs('Thu', '10:15', '12:15', [['C34', 'SE', 'SV'], ['C31', 'CN', 'VP'], ['C32', 'DWM', 'JJ'], ['C33', 'AISC', 'BJ']]),
  lec('Thu', '13:00', '14:00', 'AISC', 'TS', '508'), lec('Thu', '14:00', '15:00', 'CN', 'VP', '508'), lec('Thu', '15:00', '16:00', 'DWM', 'JJ', '508'),
  lec('Fri', '09:15', '10:15', 'SE', 'NS', '508'), lec('Fri', '10:15', '11:15', 'WMC', 'SJ', '508'), lec('Fri', '11:15', '12:15', 'DWM', 'JJ', '508'),
  lec('Fri', '13:00', '14:00', 'AISC', 'TS', '508'), lec('Fri', '14:00', '15:00', 'CN', 'VP', '508'), ...labs('Fri', '15:00', '17:00', [['C32', 'AISC', 'BJ'], ['C34', 'AISC', 'TS'], ['C33', 'CN', 'VP'], ['C31', 'DWM', 'JJ']]),
  other('Sat', '10:15', '11:15', 'REMEDIAL LECTURE', '508'), other('Sat', '11:15', '12:15', 'MENTOR MEETING'), other('Sat', '13:00', '14:00', 'MENTOR MEETING'),
]
// ------------------------------------------------------------------ AI&DS SEM V (TE) and SEM VII (BE)
const standing = days => days.map(d => other(d, '12:30', '13:00', 'Content Beyond Syllabus / Mentorship Meeting / Remedial Lecture'))
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const T1_5 = [
  lec('Mon', '09:00', '10:00', 'Stats ML&DS', 'NK'), lec('Mon', '10:00', '11:00', 'W&MC', 'ABP'), lec('Mon', '11:00', '12:00', 'AI&SC', 'HD'),
  lec('Mon', '13:00', '14:00', 'ASD&D', 'SNS'), lec('Mon', '14:00', '15:00', 'CDS', 'PP'),
  ...labs('Mon', '15:00', '17:00', [['T11', 'ASD&D', 'SNS'], ['T12', 'W&MC', 'DH'], ['T13', 'AI&SC', 'HS']]).map((x, i) => ({ ...x, room: ['203', '503', '805A'][i] })),
  lec('Tue', '08:00', '10:00', 'IKS', 'MT', '', { note: 'Printed as "Lecture-MT"' }),
  ...labs('Tue', '10:00', '12:00', [['T11', 'Stats ML&DS', 'TD'], ['T12', 'ASD&D', 'SNS'], ['T13', 'CN', 'NR']]).map((x, i) => ({ ...x, room: ['805A', '203', '805B'][i] })),
  lec('Tue', '13:00', '14:00', 'CN', 'NR'), lec('Tue', '14:00', '15:00', 'CDS', 'PP'),
  ...labs('Wed', '08:00', '10:00', [['T11', 'W&MC', 'ABP'], ['T12', 'AI&SC', 'VP'], ['T13', 'Stats ML&DS', 'TD']]).map((x, i) => ({ ...x, room: ['503', '805A', '805B'][i] })),
  e('Wed', '10:00', '12:00', 'IKS', 'MT', '208', { kind: 'lab', note: 'Printed as "IKS Lab-MT-208"' }),
  lec('Wed', '13:00', '14:00', 'CN', 'NR'), lec('Wed', '14:00', '15:00', 'AI&SC', 'HS'), lec('Wed', '15:00', '16:00', 'Stats ML&DS', 'NK'),
  lec('Thu', '09:00', '10:00', 'W&MC', 'ABP'),
  ...labs('Thu', '10:00', '12:00', [['T11', 'AI&SC', 'HS'], ['T12', 'CN', 'NR'], ['T13', 'W&MC', 'DH']]).map((x, i) => ({ ...x, room: ['805A', '805B', '503'][i] })),
  lec('Thu', '13:00', '14:00', 'ASD&D', 'NK'), lec('Thu', '14:00', '15:00', 'CN', 'HS'), lec('Thu', '15:00', '16:00', 'Stats ML&DS', 'TD'),
  lec('Fri', '09:00', '10:00', 'W&MC', 'ABP'), lec('Fri', '10:00', '11:00', 'AI&SC', 'HS'), lec('Fri', '11:00', '12:00', 'ASD&D', 'SNS'),
  ...labs('Fri', '13:00', '15:00', [['T11', 'CN', 'NR'], ['T12', 'Stats ML&DS', 'TD'], ['T13', 'ASD&D', 'SNS']]).map((x, i) => ({ ...x, room: ['805B', '805A', '203'][i] })),
  ...standing(WD),
]
const T2_5 = [
  lec('Mon', '09:00', '10:00', 'Stats ML&DS', 'TD'), lec('Mon', '10:00', '11:00', 'ASD&D', 'SNS'), lec('Mon', '11:00', '12:00', 'W&MC', 'ABP'),
  ...labs('Mon', '13:00', '15:00', [['T21', 'Stats ML&DS', 'NK'], ['T22', 'AI&SC', 'HS'], ['T23', 'CN', 'NR']]).map((x, i) => ({ ...x, room: ['503', '805A', '805B'][i] })),
  ...labs('Tue', '08:00', '10:00', [['T21', 'W&MC', 'DH'], ['T22', 'Stats ML&DS', 'NK'], ['T23', 'AI&SC', 'VP']]).map((x, i) => ({ ...x, room: ['203', '805B', '805A'][i] })),
  e('Tue', '10:00', '12:00', 'IKS', 'MT', '208', { kind: 'lab', note: 'Printed as "IKS Lab-MT-208"' }),
  lec('Tue', '13:00', '14:00', 'AI&SC', 'HD'), lec('Tue', '14:00', '15:00', 'AI&SC', 'HS'), lec('Tue', '15:00', '16:00', 'CN', 'HS'),
  lec('Wed', '09:00', '10:00', 'Stats ML&DS', 'NK'), lec('Wed', '10:00', '11:00', 'ASD&D', 'SNS'), lec('Wed', '11:00', '12:00', 'W&MC', 'ABP'),
  ...labs('Wed', '13:00', '15:00', [['T21', 'ASD&D', 'SNS'], ['T22', 'CN', 'VP'], ['T23', 'W&MC', 'DH']]).map((x, i) => ({ ...x, room: ['203', '805B', '503'][i] })), lec('Wed', '15:00', '16:00', 'CN', 'NR'),
  lec('Thu', '09:00', '10:00', 'ASD&D', 'NK'), lec('Thu', '10:00', '12:00', 'IKS', 'MT', '', { note: 'Printed as "Lecture-MT"' }),
  ...labs('Thu', '13:00', '15:00', [['T21', 'CN', 'NR'], ['T22', 'ASD&D', 'SNS'], ['T23', 'Stats ML&DS', 'TD']]).map((x, i) => ({ ...x, room: ['805B', '203', '805A'][i] })), lec('Thu', '15:00', '16:00', 'CDS', 'PP'),
  lec('Fri', '09:00', '10:00', 'Stats ML&DS', 'NK'), lec('Fri', '10:00', '11:00', 'CN', 'NR'), lec('Fri', '11:00', '12:00', 'W&MC', 'ABP'),
  lec('Fri', '13:00', '14:00', 'AI&SC', 'HS'), lec('Fri', '14:00', '15:00', 'CDS', 'PP'),
  ...labs('Fri', '15:00', '17:00', [['T21', 'AI&SC', 'HS'], ['T22', 'W&MC', 'DH'], ['T23', 'ASD&D', 'SNS']]).map((x, i) => ({ ...x, room: ['805A', '503', '203'][i] })),
  ...standing(WD),
]
const rm = (rows, rooms) => rows.map((x, i) => ({ ...x, room: rooms[i] }))
const B1_5 = [
  ...rm(labs('Mon', '10:00', '12:00', [['B11', 'BDA', 'SD'], ['B12', 'BCT', 'NK'], ['B13', 'NLP', 'NV']]), ['203', '202A', '202B']),
  lec('Mon', '13:00', '14:00', 'NLP', 'NV'), lec('Mon', '14:00', '15:00', 'NLP', 'TD'),
  e('Mon', '15:00', '17:00', 'ILOC', '', '201/11th Floor Classrooms', { note: 'Institute Level Elective (MIS/OR/CSL/PLM)' }),
  e('Tue', '10:00', '12:00', 'Major Project I', '', '104'), e('Tue', '13:00', '15:00', 'Major Project I', '', '104'), e('Tue', '15:00', '17:00', 'Major Project I', '', '104'),
  ...rm(labs('Wed', '10:00', '12:00', [['B11', 'NLP', 'NV'], ['B12', 'BDA', 'SD'], ['B13', 'DL', 'HD']]), ['805A', '203', '805B']),
  lec('Wed', '13:00', '14:00', 'BDA', 'MR'), lec('Wed', '14:00', '15:00', 'DL', 'HD'), lec('Wed', '15:00', '16:00', 'DL', 'HD'), lec('Wed', '16:00', '17:00', 'BCT', 'BJ'),
  lec('Thu', '09:00', '10:00', 'BDA', 'SD'),
  ...rm(labs('Thu', '10:00', '12:00', [['B11', 'DL', 'SD'], ['B12', 'DL', 'HD'], ['B13', 'BCT', 'BJ']]), ['202A', '202B', '203']),
  lec('Thu', '13:00', '14:00', 'NLP', 'NV'), lec('Thu', '14:00', '15:00', 'BCT', 'BJ'), lec('Thu', '15:00', '16:00', 'BCT', 'BJ'),
  ...rm(labs('Fri', '10:00', '12:00', [['B11', 'BCT', 'NK'], ['B12', 'NLP', 'NV'], ['B13', 'BDA', 'SD']]), ['202A', '202B', '203']),
  lec('Fri', '13:00', '14:00', 'BDA', 'MR'), lec('Fri', '14:00', '15:00', 'DL', 'VP'),
  e('Fri', '15:00', '17:00', 'ILOC', '', '201/11th Floor Classrooms', { note: 'Institute Level Elective (MIS/OR/CSL/PLM)' }),
  ...standing(WD),
]
const B2_5 = [
  lec('Mon', '10:00', '11:00', 'DL', 'HD'), lec('Mon', '11:00', '12:00', 'BCT', 'BJ'),
  ...rm(labs('Mon', '13:00', '15:00', [['B21', 'BDA', 'SD'], ['B22', 'BCT', 'BJ'], ['B23', 'DL', 'HD']]), ['203', '202A', '202B']),
  e('Mon', '15:00', '17:00', 'ILOC', '', '201/11th Floor Classrooms', { note: 'Institute Level Elective (MIS/OR/CSL/PLM)' }),
  lec('Tue', '10:00', '11:00', 'DL', 'HD'), lec('Tue', '11:00', '12:00', 'BDA', 'MR'),
  ...rm(labs('Tue', '13:00', '15:00', [['B21', 'BCT', 'NK'], ['B22', 'BDA', 'MR'], ['B23', 'NLP', 'NV']]), ['202A', '203', '202B']), lec('Tue', '15:00', '16:00', 'NLP', 'NV'),
  lec('Wed', '09:00', '10:00', 'BDA', 'SD'), lec('Wed', '10:00', '11:00', 'DL', 'VP'), lec('Wed', '11:00', '12:00', 'BDA', 'MR'),
  lec('Wed', '13:00', '14:00', 'BCT', 'BJ', '802'), lec('Wed', '14:00', '15:00', 'NLP', 'NV', '802'),
  ...rm(labs('Wed', '15:00', '17:00', [['B21', 'DL', 'SD'], ['B22', 'NLP', 'NV'], ['B23', 'BDA', 'MR']]), ['202A', '202B', '203']),
  e('Thu', '10:00', '12:00', 'Major Project I', '', '104'), e('Thu', '13:00', '15:00', 'Major Project I', '', '104'), e('Thu', '15:00', '17:00', 'Major Project I', '', '104'),
  lec('Fri', '10:00', '11:00', 'NLP', 'TD'), lec('Fri', '11:00', '12:00', 'BCT', 'BJ'),
  ...rm(labs('Fri', '13:00', '15:00', [['B21', 'NLP', 'NV'], ['B22', 'DL', 'HD'], ['B23', 'BCT', 'BJ']]), ['202B', '202A', '503']),
  e('Fri', '15:00', '17:00', 'ILOC', '', '201/11th Floor Classrooms', { note: 'Institute Level Elective (MIS/OR/CSL/PLM)' }),
  ...standing(WD),
]

// ------------------------------------------------------------------ legends (as printed)
const L = (faculty, subjects) => ({ faculty, subjects })
const COMP_SUB_BE = { ML: 'Machine Learning', BDA: 'Big Data Analytics', NLP: 'Natural Language Processing', BC: 'Block Chain', MIS: 'Management Information System', PR: 'Major Project I' }
const COMP_SUB_SE = { EM: 'Mathematics for Computer Engineering', DSGT: 'Discrete Structure and Graph Theory', AOA: 'Analysis of Algorithm', COA: 'Computer Organization & Architecture', WDW: 'Web Designing with Wordpress', FJP: 'Full Stack Java Programming', ED: 'Entrepreneurship Development', EVS: 'Environmental Science for Engineers' }
const COMP_SUB_TE = { SE: 'Software Engineering', CN: 'Computer Network', AISC: 'Artificial Intelligence & Soft Computing', DWM: 'Data Warehousing and Mining', WMC: 'Wireless & Mobile Communication', CDS: 'Cyber Digital Safety', IKS: 'Indian Knowledge System' }
const AI_SUB_TE = { 'Stats ML&DS': 'Statistics for Machine Learning and Data Science', 'AI&SC': 'Artificial Intelligence and Soft Computing', 'ASD&D': 'Agile Software Development and DevOps', CN: 'Computer Network', 'W&MC': 'Wireless & Mobile Communication', IKS: 'Indian Knowledge System', CDS: 'Cyber & Digital Safety' }
const AI_FAC_TE = { NK: 'Naufil Kazi', TD: "Tina D'abreo", HS: 'Hema Shukla', HD: 'Dr. Himani Deshpande', SNS: 'Dr. Sanober Shaikh', PP: 'Priyanka Patil', MT: 'Dr. Monica Tolani', NR: 'Nilam Rais', ABP: 'Dr. Anil B Patil', DH: 'Diksha Hurkat', VP: 'Vivek Prajapti' }
const AI_SUB_BE = { DL: 'Deep Learning', BDA: 'Big Data Analytics', NLP: 'Natural Language Processing', BCT: 'Blockchain Technologies', ILOC: 'Institute Level Elective' }
const AI_FAC_BE = { HD: 'Dr. Himani Deshpande', MR: 'Dr. Madhuri Rao', SD: 'Saloni Dhuru', NV: 'Naveen Vaswani', BJ: 'Dr. Bhushan Jadhav', TD: "Tina D'abreo", NK: 'Naufil Kazi', VP: 'Vivek Prajapti' }
const F = {
  TS: 'Dr. Tanuja Sarode', AP: 'Dr. Archana Patankar', SV: 'Dr. Shilpa Verma', VP: 'Ms. Vijaya Padmadas', AK: 'Mr. Aejazul Khan', SJ: 'Ms. Sonali Jadhav', NJ: 'Ms. Nidhi Jha',
  AC: 'Dr. Anil Chhangani', UB: 'Dr. Ujawala Bharambe', ASD: 'Ms. Anagha Durugkar', DK: 'Dr. Darakhshan Khan', JG: 'Dr. Jayant Gadge', VS: 'Dr. Vaishali Suryawanshi', JJ: 'Dr. Juhi Janjua',
  SK: 'Dr. Seema Kolkur', SMS: 'Dr. Sakshi Surve', RS: 'Dr. Rupali Sarode', GS: 'Dr. Gauri Shukla', RK: 'Mr. Ritesh Kini', VA: 'Mr. Vaibhav Ambhire', KI: 'Ms. Kiran Irani', SK1: 'Mr. Saket Kumar',
  SSS: 'Ms. Sonal Shroff', SI: 'Dr. Shilpa Ingoley', KA: 'Mr. Khalid Ansari', BJ: 'Ms. Bharti Jadhav', MK: 'Dr. Mansha Kotwani', TM: 'Dr. Tasneem Mirza', NS: 'Ms. Nikhat Shaikh', MD: 'Ms. Manisha Dumbre', PJ: 'Ms. Parul Jain',
}
const pick = (...codes) => Object.fromEntries(codes.map(c => [c, F[c]]))
const pickBE = { c1: pick('TS', 'AP', 'SV', 'VP', 'AK', 'SJ', 'NJ'), c2: pick('SV', 'AC', 'UB', 'ASD', 'AK', 'DK', 'NJ'), c3: pick('AP', 'JG', 'SV', 'ASD', 'VS', 'AK', 'JJ') }

const common = { effectiveFrom: '2026-07-06' }
const comp = (id, pdfFile, semester, division, entries, legend, room, issues, notes = []) => [id, { ...common, pdfFile, deptId: 'comp', semester, division, sheetLabel: id, room, header: 'Thadomal Shahani Engineering College — Time Table', entries, legend, sheetNotes: notes, sourceIssues: issues }]
const aids = (id, pdfFile, semester, division, entries, legend, room, title, issues = []) => [id, { ...common, pdfFile, deptId: 'aids', semester, division, sheetLabel: title, room, header: 'THADOMAL SHAHANI ENGINEERING COLLEGE — TIME TABLE', entries, legend, sheetNotes: ['12:30–1:00 each day: Content Beyond Syllabus / Mentorship Meeting / Remedial Lecture'], sourceIssues: issues }]

export const OFFICIAL_TIMETABLES = Object.fromEntries([
  comp('SE-C1', 'SE-C1-July-2026.pdf', 'SEM III', 'C1', SE_C1, L(pick('SV', 'SK', 'SMS', 'RS', 'GS', 'RK', 'DK', 'VA', 'KI', 'SK1'), COMP_SUB_SE), '601', []),
  comp('SE-C2', 'SE-C2-July-2026.pdf', 'SEM III', 'C2', SE_C2, L(pick('SMS', 'SSS', 'RS', 'GS', 'RK', 'VA', 'SI', 'KA', 'KI', 'BJ', 'MK'), COMP_SUB_SE), '604', []),
  comp('SE-C3', 'SE-C3-July-2026.pdf', 'SEM III', 'C3', SE_C3, L(pick('TM', 'SMS', 'ASD', 'SSS', 'RS', 'RK', 'DK', 'VA', 'KI', 'BJ', 'NS', 'MK'), COMP_SUB_SE), '505', []),
  comp('TE-C1', 'TE-C1-July-2026.pdf', 'SEM V', 'C1', TE_C1, L(pick('AC', 'SK', 'SSS', 'MD', 'SI', 'PJ', 'KA', 'NS'), COMP_SUB_TE), '504/508/404', []),
  comp('TE-C2', 'TE-C2-July-2026.pdf', 'SEM V', 'C2', TE_C2, L(pick('SV', 'TM', 'UB', 'VS', 'MD', 'AK', 'VA', 'SI', 'PJ', 'SJ', 'KA', 'BJ', 'NS'), COMP_SUB_TE), '305/504/508', []),
  comp('TE-C3', 'TE-C3-July-2026.pdf', 'SEM V', 'C3', TE_C3, L(pick('TS', 'AP', 'JG', 'SV', 'AC', 'RS', 'VP', 'AK', 'JJ', 'SJ', 'BJ', 'NS'), COMP_SUB_TE), '305/508', ['The sheet scan is low-resolution; every cell was read visually. A second pair of eyes on this sheet is recommended.']),
  comp('BE-C1', 'BE-C1-July-2026.pdf', 'SEM VII', 'C1', BE_C1, L(pickBE.c1, COMP_SUB_BE), '305/404', []),
  comp('BE-C2', 'BE-C2-July-2026.pdf', 'SEM VII', 'C2', BE_C2, L(pickBE.c2, COMP_SUB_BE), '305/404', []),
  comp('BE-C3', 'BE-C3-July-2026.pdf', 'SEM VII', 'C3', BE_C3, L(pickBE.c3, COMP_SUB_BE), '305/404', []),
  aids('T1-5', 'T1-5.pdf', 'SEM V', 'S1', T1_5, L(AI_FAC_TE, AI_SUB_TE), '801', 'TE-T1 AI & DS (Class Room: 801)'),
  aids('T2-5', 'T2-5.pdf', 'SEM V', 'S2', T2_5, L(AI_FAC_TE, AI_SUB_TE), '802', 'TE-T2 AI & DS (Class Room: 802)'),
  aids('B1-5', 'B1-5.pdf', 'SEM VII', 'S1', B1_5, L(AI_FAC_BE, AI_SUB_BE), '201', 'BE-B1 AI & DS (Class Room: 201)'),
  aids('B2-5', 'B2-5.pdf', 'SEM VII', 'S2', B2_5, L(AI_FAC_BE, AI_SUB_BE), '201', 'BE-B2 AI & DS (Class Room: 201)'),
])
