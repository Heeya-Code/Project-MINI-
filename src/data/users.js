// Mock authentication data — PROTOTYPE ONLY.
// Passwords in a file that ships to the browser are visible to anyone. A real
// deployment replaces this file and AuthContext.login() with a backend login
// (hashed passwords, session/JWT). Nothing else in the app needs to change.
export const mockUsers = [
  // Divisions of the three students were NOT specified; C1 / S1 / I1 are development placeholders.
  { email: 'student@tsec.edu', password: 'student123', role: 'student', name: 'Heeya Shewkani', department: 'comp', semester: 'SEM V', division: 'C1' },
  { email: 'student.aids@tsec.edu', password: 'student123', role: 'student', name: 'Dhwani Shriyan', department: 'aids', semester: 'SEM III', division: 'S1' },
  { email: 'student.it@tsec.edu', password: 'student123', role: 'student', name: 'Tanisha Thakur', department: 'it', semester: 'SEM VII', division: 'I1' },
  // Names are spelled exactly as printed in the official COMP sheet legends so lecture ownership (matched by name) works.
  { email: 'teacher@tsec.edu', password: 'teacher123', role: 'teacher', name: 'Dr. Rupali Sarode', department: 'comp' },
  { email: 'teacher2@tsec.edu', password: 'teacher123', role: 'teacher', name: 'Dr. Sakshi Surve', department: 'comp' },
  { email: 'admin@tsec.edu', password: 'admin123', role: 'management', name: 'Dr. S. Iyer', department: null },
]
