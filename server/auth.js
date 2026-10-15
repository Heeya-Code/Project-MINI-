import crypto from 'node:crypto'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}
export function verifyPassword(password, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$')
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return crypto.timingSafeEqual(expected, actual)
}
const sha = t => crypto.createHash('sha256').update(t).digest('hex')

export function createSession(db, userId, hours) {
  const token = crypto.randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha(token), userId, Date.now() + hours * 3600 * 1000)
  return token
}
export function destroySession(db, token) { if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token)) }
export function userForToken(db, token) {
  if (!token) return null
  const row = db.prepare(`SELECT u.id, u.email, u.name, u.role, u.department, u.semester, u.division, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(token))
  if (!row) return null
  if (row.expires_at < Date.now()) { destroySession(db, token); return null }
  const { expires_at: _e, ...user } = row
  return user
}
export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(p => p.trim()).filter(Boolean).map(p => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))] }))
}
export const COOKIE = 'tsec_sid'
