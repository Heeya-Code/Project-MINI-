// Transcription of the third batch of official timetables (W.E.F. 06 Jul 2026):
//   AI&DS SEM III  S1 (S1-5.pdf, "SE-S1 AI & DS") and S2 (S2-5.pdf, "SE-S2 AI & DS")
//   EXTC  SEM III / V / VII  (SE-ETC-1, TE-ETC-1, BE-ETC-1)   — one class per semester, NO division
//   Chemistry SEM III / V / VII  (SE_CHEM, TE_CHEM, BE_CHEM) — one class per semester, NO division
// Same rules as before: exactly what is printed; every doubt is written to `sourceIssues`. Times are 24h.
const D = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const e = (day, start, end, subject, faculty, room, x = {}) => ({ day: D[day], start, end, kind: x.kind || 'lecture', subject, faculty: faculty || '', room: room || '', batch: x.batch || '', label: x.label || '', note: x.note || '' })
const other = (day, s, t, subject, note = '') => e(day, s, t, subject, '', '', { kind: 'other', note })
const brk = (days, s, t, name) => days.map(d => e(d, s, t, name, '', '', { kind: 'break' }))
// parallel batches over one block: [[batch, subject, faculty, room], ...]
const labs = (day, s, t, rows) => rows.map(([b, subj, fac, room]) => e(day, s, t, subj, fac, room, { kind: 'lab', batch: b }))
const standing = days => days.map(d => other(d, '12:30', '13:00', 'Content Beyond Syllabus / Mentorship Meeting / Remedial Lecture'))
const L = (faculty, subjects) => ({ faculty, subjects })
const common = { effectiveFrom: '2026-07-06' }

// ====================================================================== AI&DS SEM III
const AI_SUB = { MCE: 'Mathematics for Computer Engineering', DSGT: 'Discrete Structures and Graph Theory', AOA: 'Analysis of Algorithm', COA: 'Computer organization & Architecture', Java: 'Full Stack Java Programming', ED: 'Entrepreneurship Development', ESE: 'Environmental Science for Engineers', DPS: 'Data Privacy and Security' }
const AI_FAC = { SK: 'Saket Kumar', AS: 'Dr. Anagha Shastri', VD: 'Vipra Dave', SY: 'Sagar Yehswantrao', MT: 'Dr. Monica Tolani', VP: 'Vivek Prajapati', NR: 'Nilam Rais', PP: 'Priyanka Patil', DH: 'Diksha Hurkat' }
const tut = (day, s, t, batch, fac) => e(day, s, t, 'MCE', fac, '', { kind: 'tutorial', batch, label: 'Tut' })
const S1_5 = [
  ...labs('Mon', '08:00', '10:00', [['S11', 'COA', 'VD', '503'], ['S12', 'AOA', 'AS', '202A'], ['S13', 'Java', 'SY', '208A']]),
  e('Mon', '10:00', '12:00', 'ED', 'MT', '208/901', { note: 'Printed as "Entrepreneurship Development — Lecture- MT (208/901)"' }),
  e('Mon', '13:00', '14:00', 'COA', 'VD'), e('Mon', '14:00', '15:00', 'AOA', 'AS'), tut('Mon', '15:00', '16:00', 'S12', 'SK'),
  e('Tue', '09:00', '10:00', 'AOA', 'NR'),
  ...labs('Tue', '10:00', '12:00', [['S11', 'Java', 'VP', '202B'], ['S12', 'COA', 'VD', '503'], ['S13', 'AOA', 'AS', '202A']]),
  e('Tue', '13:00', '14:00', 'DSGT', 'DH'), tut('Tue', '14:00', '15:00', 'S11', 'SK'), e('Tue', '15:00', '16:00', 'Java', 'VP'),
  e('Wed', '08:00', '10:00', 'ED', 'MT', '208', { kind: 'lab', note: 'Printed as "Entrepreneurship Development — Practical- MT- 208"' }),
  e('Wed', '10:00', '11:00', 'COA', 'VD'), e('Wed', '11:00', '12:00', 'DPS', 'PP'), e('Wed', '13:00', '15:00', 'MCE', 'SK'), tut('Wed', '15:00', '16:00', 'S13', 'SK'),
  e('Thu', '09:00', '10:00', 'DSGT', 'DH'), e('Thu', '10:00', '11:00', 'Java', 'SY'), e('Thu', '11:00', '12:00', 'COA', 'VD'),
  e('Thu', '13:00', '15:00', 'ESE', 'SY', '208', { kind: 'lab', note: 'Printed as "Environmental Science for Engineers — Practical- SY- 208"' }),
  ...labs('Fri', '08:00', '10:00', [['S11', 'AOA', 'AS', '202A'], ['S12', 'Java', 'VP', '208A'], ['S13', 'COA', 'VD', '503']]),
  e('Fri', '10:00', '11:00', 'DPS', 'PP'), e('Fri', '11:00', '12:00', 'DSGT', 'DH'), e('Fri', '13:00', '14:00', 'AOA', 'AS'),
  e('Fri', '14:00', '16:00', 'ESE', 'SY', '', { note: 'Printed as "Environmental Science for Engineers — Lecture- SY"' }),
  ...brk(WD, '12:00', '12:30', 'LUNCH BREAK'), ...standing(WD),
]
const S2_5 = [
  e('Mon', '09:00', '10:00', 'Java', 'VP'), e('Mon', '10:00', '11:00', 'COA', 'VD'), e('Mon', '11:00', '12:00', 'DSGT', 'DH'),
  e('Mon', '13:00', '15:00', 'ED', 'MT', '208', { kind: 'lab', note: 'Printed as "Entrepreneurship Development — Practical- MT- 208"' }), e('Mon', '15:00', '16:00', 'DPS', 'PP'),
  ...labs('Tue', '08:00', '10:00', [['S21', 'COA', 'VD', '503'], ['S22', 'AOA', 'AS', '202A'], ['S23', 'Java', 'SY', '202B']]),
  e('Tue', '10:00', '11:00', 'Java', 'SY'), e('Tue', '11:00', '12:00', 'DSGT', 'DH'),
  e('Tue', '13:00', '14:00', 'MCE', 'SK', '', { kind: 'tutorial', batch: 'S21', label: 'Tut', note: 'Printed as "MEC Tut" (legend says MCE)' }),
  e('Tue', '14:00', '16:00', 'ESE', 'SY', '', { note: 'Printed as "Environmental Science for Engineers — Lecture- SY"' }),
  e('Wed', '09:00', '10:00', 'DSGT', 'DH'),
  ...labs('Wed', '10:00', '12:00', [['S21', 'Java', 'SY', '202B'], ['S22', 'COA', 'HS', '503'], ['S23', 'AOA', 'AS', '202A']]),
  e('Wed', '13:00', '14:00', 'AOA', 'AS'), e('Wed', '14:00', '15:00', 'COA', 'VD'),
  e('Thu', '08:00', '10:00', 'ED', 'MT', '208/907', { note: 'Printed as "Entrepreneurship Development — Lecture- MT (208/907)"' }),
  e('Thu', '10:00', '11:00', 'DPS', 'PP'), e('Thu', '11:00', '12:00', 'AOA', 'AS'),
  ...labs('Thu', '13:00', '15:00', [['S21', 'AOA', 'AS', '202A'], ['S22', 'Java', 'VP', '202B'], ['S23', 'COA', 'VD', '503']]),
  e('Thu', '15:00', '16:00', 'MCE', 'SK', '', { kind: 'tutorial', batch: 'S22', label: 'Tut', note: 'Printed as "MEC Tut"' }),
  e('Fri', '08:00', '09:00', 'MCE', 'SK', '', { kind: 'tutorial', batch: 'S23', label: 'Tut', note: 'Printed as "MEC Tut"' }), e('Fri', '09:00', '10:00', 'AOA', 'NR'),
  e('Fri', '10:00', '12:00', 'ESE', 'SY', '208', { kind: 'lab', note: 'Printed as "Environmental Science for Engineers — Practical- SY 208"' }),
  e('Fri', '13:00', '15:00', 'MCE', 'SK', '', { note: 'Printed as "MEC — SK"' }), e('Fri', '15:00', '16:00', 'COA', 'VD'),
  ...brk(WD, '12:00', '12:30', 'LUNCH BREAK'), ...standing(WD),
]

// ====================================================================== EXTC (one class per semester)
const hrs2 = (day, s, subj, fac, room, x) => [e(day, s, addH(s, 1), subj, fac, room, x), e(day, addH(s, 1), addH(s, 2), subj, fac, room, x)]
function addH(t, n) { const [h, m] = t.split(':').map(Number); return `${String(h + n).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
const LUNCH_ETC = brk(WD, '12:30', '13:00', 'LUNCH BREAK')
const SE_ETC = [
  ...hrs2('Mon', '08:30', 'OE', 'BI'),
  ...labs('Mon', '10:30', '12:30', [['A1', 'EDLIC', 'NP', '701'], ['A2', 'DSD', 'SB', '706'], ['A3/A4', 'JAVA/C++', 'RP/MSK', '602/605']]),
  e('Mon', '13:00', '14:00', 'JAVA', 'MSK'), e('Mon', '14:00', '15:00', 'C++', 'RP'),
  ...hrs2('Tue', '08:30', 'EVS', 'SB'), e('Tue', '10:30', '11:30', 'NT&CS', 'NP'), e('Tue', '11:30', '12:30', 'EDLIC', 'NP'),
  ...hrs2('Tue', '13:00', 'DSD', 'UB'), e('Tue', '15:00', '17:00', 'DSD', 'UB', '706', { kind: 'lab', batch: 'A1' }),
  ...labs('Wed', '08:30', '10:30', [['A1/A2', 'ED', 'BI', '702'], ['A3/A4', 'EVS', 'SB', '803']]), e('Wed', '10:30', '11:30', 'EDLIC', 'UB'), e('Wed', '11:30', '12:30', 'MSA', 'PS'),
  ...hrs2('Wed', '13:00', 'NT&CS', 'NP'),
  ...labs('Thu', '08:30', '10:30', [['A1', 'JAVA/C++', 'RP', '605'], ['A3/A4', 'ED', 'BI', '702'], ['A2', 'EDLIC', 'NP', '701']]),
  e('Thu', '10:30', '11:30', 'DSD', 'UB'), e('Thu', '11:30', '12:30', 'EDLIC', 'NP'), ...hrs2('Thu', '13:00', 'MSA', 'PS'),
  ...hrs2('Fri', '08:30', 'ED', 'BI'),
  ...labs('Fri', '10:30', '12:30', [['A3', 'DSD', 'UB', '706'], ['A4', 'EDLIC', 'NP', '701'], ['A1/A2', 'EVS', 'SB', '803']]),
  ...labs('Fri', '13:00', '15:00', [['A4', 'DSD', 'UB', '706'], ['A2', 'JAVA/C++', 'RP', '605'], ['A3', 'EDLIC', 'NP', '701']]),
  ...LUNCH_ETC,
]
const TE_ETC = [
  ...labs('Mon', '08:30', '10:30', [['A4', 'DTSP', 'DT', '609'], ['A1/A2', 'IKS', 'UB', '803'], ['A3', 'AOA', 'MSK', '602']]),
  e('Mon', '10:30', '11:30', 'DTSP', 'DT'), e('Mon', '11:30', '12:30', 'DTSP', 'DT'), e('Mon', '13:00', '14:00', 'EMA', 'JK'),
  e('Mon', '14:00', '15:00', 'OE', 'AH'), e('Mon', '15:00', '16:00', 'OE', 'AH'),
  e('Tue', '08:30', '09:30', 'DTSP', 'DT'), e('Tue', '09:30', '10:30', 'ML/DCE', 'BI/MR', '806/609'),
  ...labs('Tue', '10:30', '12:30', [['A3', 'CCN', 'AR', '605'], ['A1/A2', 'ML', 'BI', '609'], ['A1/A2', 'DCE', 'MR', '602'], ['A4', 'EMA', 'RP', '803']]),
  ...hrs2('Tue', '13:00', 'CCN', 'AR'),
  ...hrs2('Wed', '08:30', 'EMA', 'RP'),
  ...labs('Wed', '10:30', '12:30', [['A1', 'EMA', 'RP', '803'], ['A2', 'DTSP', 'DT', '609'], ['A3/A4', 'ML', 'BI', '605'], ['A3/A4', 'DCE', 'AH', '602']]),
  ...hrs2('Wed', '13:00', 'AOA', 'MSK'), e('Wed', '15:00', '17:00', 'AOA', 'MSK', '602', { kind: 'lab', batch: 'A1' }),
  ...labs('Thu', '08:30', '10:30', [['A1', 'DTSP', 'DT', '609'], ['A3/A4', 'IKS', 'UB', '803']]),
  e('Thu', '10:30', '11:30', 'ML/DCE', 'BI/MR', '806/609'), e('Thu', '11:30', '12:30', 'CCN', 'AR'),
  ...labs('Thu', '13:00', '15:00', [['A2', 'AOA', 'MSK', '602'], ['A3', 'EMA', 'JK', '803'], ['A4', 'CCN', 'AR', '605']]), e('Thu', '15:00', '17:00', 'AOA', 'MSK', '602', { kind: 'lab', batch: 'A4' }),
  ...hrs2('Fri', '08:30', 'IKS', 'UB'), e('Fri', '10:30', '11:30', 'ML/DCE', 'DT/MR', '806/609'), e('Fri', '11:30', '12:30', 'AOA', 'MSK'),
  ...labs('Fri', '13:00', '15:00', [['A2', 'EMA', 'JK', '803'], ['A1', 'CCN', 'AR', '605'], ['A3', 'DTSP', 'DT', '609']]), e('Fri', '15:00', '17:00', 'CCN', 'AR', '605', { kind: 'lab', batch: 'A2' }),
  ...LUNCH_ETC,
]
const BE_ETC = [
  e('Mon', '08:30', '09:30', 'DL', 'MR', '806'), e('Mon', '09:30', '10:30', 'ICE', 'AR', '806'), e('Mon', '10:30', '11:30', 'MWAVE', 'JK', '702'),
  e('Mon', '11:30', '12:30', 'MCS', 'AH', '702', { label: '12 PM' }), e('Mon', '14:00', '15:00', 'ICE', 'SB', '609'), e('Mon', '15:00', '17:00', 'ILOC', '', '', { kind: 'elective' }),
  e('Tue', '10:30', '12:30', 'PROJECT', '', '', { kind: 'other' }),
  ...labs('Tue', '13:00', '15:00', [['A2', 'MCS', 'AH', '605/803'], ['A1', 'MW', 'JK', '605/803']]), ...labs('Tue', '15:00', '17:00', [['A1', 'MCS', 'AH', '605/803'], ['A2', 'MW', 'JK', '605/803']]),
  e('Wed', '10:30', '12:30', 'PROJECT', '', '', { kind: 'other' }), e('Wed', '13:00', '15:00', 'PROJECT', '', '', { kind: 'other' }), e('Wed', '15:00', '17:00', 'PROJECT', '', '', { kind: 'other' }),
  e('Thu', '10:30', '12:30', 'MW', 'JK', '803', { kind: 'lab', batch: 'A3' }), e('Thu', '13:00', '15:00', 'MCS', 'AH', '602', { kind: 'lab', batch: 'A3' }), e('Thu', '15:00', '17:00', 'PROJECT', '', '', { kind: 'other' }),
  e('Fri', '08:30', '09:30', 'DL', 'MR'), e('Fri', '09:30', '10:30', 'DL', 'MR', '702'), e('Fri', '10:30', '11:30', 'MW', 'JK', '702'),
  e('Fri', '11:30', '12:30', 'MCS', 'AH', '702', { label: '12 PM' }), e('Fri', '14:00', '16:00', 'ILOC', '', '', { kind: 'elective' }),
  ...LUNCH_ETC,
]

// ====================================================================== CHEMISTRY (one class per semester)
// Periods: 8-9 (Remedial), 9:00-10:00, [tea 10:00-10:15], 10:15-11:15, 11:15-12:15, [lunch 12:15-13:00], 13:00-14:00 ... 16:00-17:00
const TEA = brk(WD, '10:00', '10:15', 'TEA BREAK'), LUNCH_CH = brk(WD, '12:15', '13:00', 'LUNCH BREAK')
const rem = (day, s, t) => other(day, s, t, 'Remedial Lecture')
const SE_CHEM = [
  rem('Mon', '08:00', '09:00'), ...labs('Mon', '09:00', '11:15', [['K1', 'PC', 'PP', ''], ['K2', 'FFO', 'SG', ''], ['K3', 'ED', 'NP', '']]), e('Mon', '11:15', '12:15', 'PC', 'PP'),
  e('Mon', '13:00', '14:00', 'FFO', 'SG'), e('Mon', '14:00', '15:00', 'ED', 'NP'), e('Mon', '15:00', '16:00', 'MPR', ''), rem('Mon', '16:00', '17:00'),
  rem('Tue', '08:00', '09:00'), ...labs('Tue', '09:00', '11:15', [['K2', 'EVS', 'PN', ''], ['K3', 'PC', 'PP', ''], ['K1', 'FFO', 'SG', '']]), e('Tue', '11:15', '12:15', 'EVS', 'PN'),
  e('Tue', '13:00', '14:00', 'EVS', 'PN'), e('Tue', '14:00', '15:00', 'CEM', 'PS'), e('Tue', '15:00', '16:00', 'CEM', 'PS', '', { batch: 'K2' }), rem('Tue', '16:00', '17:00'),
  rem('Wed', '08:00', '09:00'), ...labs('Wed', '09:00', '11:15', [['K2', 'PC', 'PP', ''], ['K3', 'FFO', 'SG', ''], ['K1', 'EVS', 'PN', '']]), e('Wed', '11:15', '12:15', 'FFO', 'SG'),
  e('Wed', '13:00', '14:00', 'CEM', 'PS'), e('Wed', '14:00', '15:00', 'CET', 'TD'), e('Wed', '15:00', '16:00', 'CEM', 'PS', '', { batch: 'K1' }), rem('Wed', '16:00', '17:00'),
  rem('Thu', '08:00', '09:00'), e('Thu', '09:00', '10:00', 'PC', 'PP'), e('Thu', '10:15', '11:15', 'OE', 'PN'), e('Thu', '11:15', '12:15', 'FFO', 'SG'),
  e('Thu', '13:00', '14:00', 'CET', 'TD'), e('Thu', '14:00', '15:00', 'ED', 'NP'), e('Thu', '15:00', '16:00', 'CEM', 'PS', '', { batch: 'K3' }), rem('Thu', '16:00', '17:00'),
  rem('Fri', '08:00', '09:00'), e('Fri', '09:00', '10:00', 'OE', 'PN'), e('Fri', '10:15', '11:15', 'CET', 'TD'), e('Fri', '11:15', '12:15', 'PC', 'PP'),
  ...labs('Fri', '13:00', '15:00', [['K1', 'ED', 'MK', ''], ['K2', 'ED', 'NP', ''], ['K3', 'EVS LAB', 'PN', '']]), rem('Fri', '15:00', '16:00'), rem('Fri', '16:00', '17:00'),
  ...TEA, ...LUNCH_CH,
]
const TE_CHEM = [
  rem('Mon', '08:00', '09:00'), e('Mon', '09:00', '10:00', 'PE', 'RI'), e('Mon', '10:15', '11:15', 'TP', 'RJ'), e('Mon', '11:15', '12:15', 'IKS', 'RI'),
  e('Mon', '13:00', '14:00', 'CRE I', 'NM'), ...labs('Mon', '14:00', '16:00', [['K3', 'CRE I', 'NM', ''], ['K2', 'TP', 'RJ', ''], ['K1', 'PDE', 'TD', '']]), rem('Mon', '16:00', '17:00'),
  rem('Tue', '08:00', '09:00'), e('Tue', '09:00', '10:00', 'MDC', ''), e('Tue', '10:15', '11:15', 'PE', 'RI'), e('Tue', '11:15', '12:15', 'MTO I', 'RJ'),
  e('Tue', '13:00', '14:00', 'CRE I', 'NM'), ...labs('Tue', '14:00', '16:00', [['K1', 'CRE I', 'NM', ''], ['K3', 'MTO I', 'RJ', ''], ['K2', 'PDE', 'RI', '']]), rem('Tue', '16:00', '17:00'),
  e('Wed', '08:00', '09:00', 'MDC', ''), e('Wed', '09:00', '10:00', 'MDC', ''), e('Wed', '10:15', '11:15', 'NCSE', 'NP'), e('Wed', '11:15', '12:15', 'MTO I', 'RJ'),
  e('Wed', '13:00', '14:00', 'NCSE', 'PN'), ...labs('Wed', '14:00', '16:00', [['K1', 'TP', 'NM', ''], ['K2', 'MDL', 'MK', ''], ['K3', 'IKS', 'NP', '']]), rem('Wed', '16:00', '17:00'),
  rem('Thu', '08:00', '09:00'), e('Thu', '09:00', '10:00', 'IKS', 'RI'),
  ...labs('Thu', '10:15', '12:15', [['K3', 'MDL', '', ''], ['K1', 'MDL', 'MK', ''], ['K2', 'IKS', 'NP', '']]),
  e('Thu', '13:00', '14:00', 'TP', 'RJ'), e('Thu', '14:00', '15:00', 'TP', 'RJ'), e('Thu', '15:00', '16:00', 'PE', 'RI'), rem('Thu', '16:00', '17:00'),
  rem('Fri', '08:00', '09:00'), ...labs('Fri', '09:00', '11:15', [['K2', 'MTO I', 'PP', ''], ['K3', 'TP', 'RJ', ''], ['K1', 'IKS', 'NP', '']]), e('Fri', '11:15', '12:15', 'CRE I', 'NM'),
  e('Fri', '13:00', '14:00', 'MTO I', 'RJ'), ...labs('Fri', '14:00', '16:00', [['K2', 'CRE I', 'NM', ''], ['K1', 'MTO I', 'SG', ''], ['K3', 'PDE', 'RI', '']]), rem('Fri', '16:00', '17:00'),
  ...TEA, ...LUNCH_CH,
]
const BE_CHEM = [
  rem('Mon', '08:00', '09:00'), ...labs('Mon', '09:00', '12:15', [['K1', 'IPDC', 'TD', ''], ['K2', 'CEED', 'RB', ''], ['K3', 'HRA', 'MK', '']]),
  e('Mon', '13:00', '14:00', 'PMCPI', 'NP'), e('Mon', '14:00', '15:00', 'CEED', 'RB'), e('Mon', '15:00', '16:00', 'ILOC', 'PN', '', { kind: 'elective' }), e('Mon', '16:00', '17:00', 'ILOC', 'PN', '', { kind: 'elective' }),
  rem('Tue', '08:00', '09:00'), e('Tue', '09:00', '10:00', 'PRT', 'MK'), e('Tue', '10:15', '11:15', 'IPDC', 'TD'), e('Tue', '11:15', '12:15', 'PMCPI', 'NP'),
  ...labs('Tue', '13:00', '16:00', [['K3', 'IPDC', 'TD', ''], ['K1', 'CEED', 'RB', ''], ['K2', 'HRA', 'MK', '']]), rem('Tue', '16:00', '17:00'),
  e('Wed', '09:00', '12:15', 'PROJECT', '', '', { kind: 'other', note: 'Printed vertically (P-R-O) across the Wednesday morning columns' }),
  e('Wed', '13:00', '17:00', 'PROJECT', '', '', { kind: 'other', note: 'Printed vertically (J-E-C-T) across the Wednesday afternoon columns' }),
  rem('Thu', '08:00', '09:00'), rem('Thu', '09:00', '10:00'), rem('Thu', '10:15', '11:15'), e('Thu', '11:15', '12:15', 'IPDC', 'TD'), e('Thu', '13:00', '14:00', 'PMCPI', 'NP'),
  ...labs('Thu', '14:00', '17:00', [['K2', 'IPDC', 'SG', ''], ['K3', 'CEED', 'RB', ''], ['K1', 'HRA', 'MK', '']]),
  rem('Fri', '08:00', '09:00'), e('Fri', '09:00', '10:00', 'PRT', 'MK'), e('Fri', '10:15', '11:15', 'PRT', 'MK'), e('Fri', '11:15', '12:15', 'IPDC', 'TD'),
  e('Fri', '13:00', '14:00', 'CEED', 'RB'), e('Fri', '14:00', '15:00', 'CEED', 'RB'), e('Fri', '15:00', '16:00', 'ILOC', 'PN', '', { kind: 'elective' }), e('Fri', '16:00', '17:00', 'ILOC', 'PN', '', { kind: 'elective' }),
  ...TEA, ...LUNCH_CH,
]

// ====================================================================== legends (as printed)
const ETC_SE = L({ PS: 'Dr. Poonam Soni', NP: 'Prof. Neeru Pathak', UB: 'Prof. Uttara Bh', SB: 'Dr.Shrishti Bhatia', BI: 'Prof. Bharati Ingale', MSK: 'Prof. Manoj Kavedia', RP: 'Dr. Rajat Palliwal' },
  { MSA: 'Mathematics for Singnal Analysis', EDLIC: 'Electron Devices and Linear Circuits', DSD: 'Digital System Design', 'NT&CS': 'Networks and Control Systems', EVS: 'Environmental Science', ED: 'Entrepreneurship Development', 'JAVA/C++': 'C++ and Java Programming', JAVA: 'C++ and Java Programming', 'C++': 'C++ and Java Programming', OE: 'Open Elective' })
const ETC_TE = L({ JK: 'Prof. Jyoti Kashyap', AR: 'Prof. Anuradha Rao', DT: 'Dr. Dhahanjay Theckedath', MSK: 'Dr. Manoj Kavedia', BI: 'Prof. Bharati Ingale', MR: 'Dr. Maniroja', UB: 'Prof.Uttara Bhatt', AH: 'Prof. Amit Hatekar' },
  { EMA: 'Electromagnetics and Antenna', CCN: 'Computer Communication Networks', DTSP: 'Discrete Time Signal Processing', AOA: 'Analysis of Algorithms', ML: 'Machine Learning', DCE: 'Data Compression and Cryptography', 'ML/DCE': 'Machine Learning / Data Compression and Cryptography', IKS: 'Indian Knowledge System', OE: 'Open Elective' })
const ETC_BE = L({ AR: 'Prof. Anuradha Rao', AH: 'Prof. Amit Hatekar', MR: 'Dr. Maniroja', SB: 'Dr. Shrishti Bhatia' },
  { MW: 'Microwave Engineering', MCS: 'Mobile Communication System', DL: 'Deep laerning', ICE: 'Internet Communication Engg' })
const CH_SE = L({ NM: 'Dr. Nita Mehta', PP: 'Prof. Prasad Parulekar', SB: 'Prof. Sangita Borkar', TD: 'Dr. Trupti Dharmarao', MK: 'Prof. Mannat Khanwani', PN: 'Dr. Praseeda Nambisan', PS: 'Dr. Poonam Soni' },
  { CEM: 'Chemical Engineering Mathematics', FFO: 'fluid Flow mechanical operation', PC: 'Process calculations', CET: 'Chemical engineering thermodynamics I', OE: 'Open Elective', ED: 'Entrepreneurship Development', EVS: 'Environmental science for Engineers' })
const CH_TE = L({ NM: 'Prof. Nita Mehta', RI: 'Prof. Ramkrishna Iyer', PP: 'Prof.Prasad Parulekar', RJ: 'Prof. Ravindra Joshi', SB: 'Prof. Sangita Borkar', TD: 'Dr. Trupti Dharmarao', NP: 'Dr. Nitin Pereira', PN: 'Dr. Praseeda Nambisan' },
  { 'MTO I': 'Mass transfer operations I', 'CRE I': 'Chemical Reaction Engg I', TP: 'Transport phenomenon', PE: 'Piping Engineering', MDC: 'Multidisciplinary Minor', IKS: 'Indian Knowledge System', NCSE: 'Non-Conventional Sources of Energy' })
const CH_BE = L({ RB: 'Dr. Ramesh Bhande', SB: 'Prof. Sangita Borkar', TD: 'Dr. Trupti Dharmarao', MK: 'Mannat Khanwani', NP: 'Dr. Nitin Pereira', PN: 'Dr. Praseeda Nambisan' },
  { IPDC: 'Instrumentation Process Dynamics and Control', CEED: 'Chemical Engineering Equipment Design', PMCPI: 'Project Management for Chemical Process Industries', PRT: 'Petroleum Refining technology', HRA: 'Hazard and Risk assessment Lab' })

const mk = (id, pdfFile, deptId, semester, division, entries, legend, room, sheetLabel, sheetNotes, sourceIssues) =>
  [id, { ...common, pdfFile, deptId, semester, division, sheetLabel, room, header: 'THADOMAL SHAHANI ENGINEERING COLLEGE — TIME TABLE', entries, legend, sheetNotes, sourceIssues }]
const FIX_STD = 'Standing slot 12:30–1:00 every day: Content Beyond Syllabus / Mentorship Meeting / Remedial Lecture'

export const OFFICIAL_TIMETABLES_2 = Object.fromEntries([
  mk('S1-5', 'S1-5.pdf', 'aids', 'SEM III', 'S1', S1_5, L(AI_FAC, AI_SUB), '901', 'SE-S1 AI & DS (Class Room: 901)', [FIX_STD], [
    'Wednesday 8:00–10:00 and Monday 10:00–12:00 print the Entrepreneurship Development session as "Practical- MT- 208" / "Lecture- MT (208/901)"; stored as printed (note on each entry).',
    'Subjects are printed in full in the grid (e.g. "Entrepreneurship Development"); they are stored with the legend codes ED / ESE.',
    'MCE Tut sessions carry a batch and faculty (e.g. "S12- SK"); stored as tutorials for that batch.']),
  mk('S2-5', 'S2-5.pdf', 'aids', 'SEM III', 'S2', S2_5, L({ ...AI_FAC, HS: 'Hema Shukla' }, AI_SUB), '907', 'SE-S2 AI & DS (Class Room: 907)', [FIX_STD], [
    'The grid prints the tutorial subject as "MEC Tut" while the legend defines MCE (Mathematics for Computer Engineering); stored as MCE with the printed form in the entry note.',
    'Faculty code HS (Hema Shukla) appears only in this sheet\'s legend; it teaches COA batch S22 on Wednesday.']),
  mk('SE-ETC-1', 'SE-ETC-1.pdf', 'extc', 'SEM III', '', SE_ETC, ETC_SE, '702', 'SE/III/EXTC — Room 702', [], [
    'Legend text "Prof. Uttara Bh" is cut off on the sheet (the TE sheet prints Prof. Uttara Bhatt); stored as printed.',
    'Legend lists Prof. Bharati Ingale (BI) twice; stored once.',
    'Rows "A3/A4 JAVA/C++ (RP/MSK) 602/605": two faculty and two rooms are printed for one cell; the faculty-to-room pairing is not stated, so both are kept as printed.',
    'Legend defines "C++/JAVA"; the grid uses JAVA, C++ and JAVA/C++ — all mapped to the same printed name.']),
  mk('TE-ETC-1', 'TE-ETC-1.pdf', 'extc', 'SEM V', '', TE_ETC, ETC_TE, '806', 'SE/V/EXTC — Room 806', [], [
    'Faculty code RP (used for EMA) is not in this sheet\'s legend (the SE sheet defines RP as Dr. Rajat Palliwal); kept as the code only.',
    '"ML/DCE (BI/MR) (806/609)" is one cell for two subjects with two faculty and two rooms; the pairing is not stated, so it is stored as one combined entry. Friday prints "(DT/MR)" for the same cell.',
    'Tuesday and Wednesday 10:30–12:30: "A1/A2 ML" and "A1/A2 DCE" both name batches A1/A2 in the same slot; the split between A1 and A2 is not printed (the validator reports this as a batch overlap).',
    'Wednesday 10:30–12:30: "A3/A4 ML" and "A3/A4 DCE" — same situation for A3/A4.']),
  mk('BE-ETC-1', 'BE-ETC-1.pdf', 'extc', 'SEM VII', '', BE_ETC, ETC_BE, '', 'SE/VII/EXTC — BE', ['Monday: afternoon classes start at 1:30 PM (printed "1.30 PM" in the 1:00–2:00 column).'], [
    'Faculty code JK is used (MWAVE / MW) but is not in this sheet\'s legend (the TE sheet defines JK as Prof. Jyoti Kashyap); kept as the code only.',
    'MCS on Monday and Friday is printed in the 11:30–12:30 column with "12 PM"; the grid slot is kept and "12 PM" is stored as the printed time label. The end time is not printed.',
    'Monday MWAVE and the other days\' "MW" refer to the same legend subject MW (Microwave Engineering); stored as printed.',
    'Tuesday 1:00–5:00: rooms "605/803" are printed once for the two batches (A1/A2); the pairing is not stated.',
    'PROJECT and ILOC are not defined in the legend; they have no faculty or room on the sheet.',
    'No class room is printed in the header (the header shows only "BE").']),
  mk('SE-CHEM', 'SE_CHEM.pdf', 'chem', 'SEM III', '', SE_CHEM, CH_SE, '308', 'CHEMICAL ENGG. — Sem III — Classroom 308', [], [
    'Faculty code SG is used (FFO) but the legend defines SB (Prof. Sangita Borkar); SG is kept as printed, it is NOT assumed to be SB.',
    'Faculty code NP (ED) is used but is not in the legend (the legend defines NM, Dr. Nita Mehta); NP is kept as printed.',
    'MPR (Monday 3:00–4:00) is not defined in the legend and has no faculty.',
    'Monday–Wednesday 9:00–11:15: three batches (K1/K2/K3) are printed in one merged cell spanning the 10:00–10:15 tea break; stored as 9:00–11:15.',
    'Single-slot CEM entries with a batch (K1/K2/K3) are printed without LAB/Tut wording; stored as lecture-type entries for that batch.',
    'The scan was read at high zoom; the row for Saturday is blank on the sheet.']),
  mk('TE-CHEM', 'TE_CHEM.pdf', 'chem', 'SEM V', '', TE_CHEM, CH_TE, '309', 'CHEMICAL ENGG. — Sem V — Classroom 309', [], [
    'Faculty code SG (Friday MTO I, batch K1) is not in the legend; kept as printed.',
    'MDL and PDE are used but are not defined in the legend; MDC has no faculty printed; faculty code MK (MDL) is not in the legend either.',
    'Thursday 10:15–12:15: "MDL (K3)/MDL (K1) (MK)/IKS (K2) (NP)" — only one (MK) is printed for the two MDL batches; MDL (K3) is stored WITHOUT a faculty rather than assuming MK.',
    'Classroom number reads "309" at the bottom of the sheet; the digit is slightly smudged in the scan.',
    'Batch blocks that cross the 10:00–10:15 tea break are stored as printed (9:00–11:15).']),
  mk('BE-CHEM', 'BE_CHEM.pdf', 'chem', 'SEM VII', '', BE_CHEM, CH_BE, '108', 'CHEMICAL ENGG. — Sem VII — Classroom 108', [], [
    'Faculty code SG (Thursday IPDC, batch K2) is not in the legend; kept as printed.',
    'The cells for batch K3 on Monday (HRA) and for the HRA batches on Tuesday and Thursday are drawn with unclear extents; because the three batches rotate IPDC/CEED/HRA, all three are stored on the same block (Mon 9:00–12:15, Tue 13:00–16:00, Thu 14:00–17:00). Please verify these three blocks against the paper sheet.',
    'ILOC is not defined in the legend.',
    'Wednesday is printed as the single word PROJECT spread over the columns (P-R-O … J-E-C-T); stored as two PROJECT entries (morning and afternoon).']),
])
