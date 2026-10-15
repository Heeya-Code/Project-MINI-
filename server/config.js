import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(here, '..')

// Minimal .env loader (KEY=value lines, # comments). Real environment variables always win over the file, and the
// file is optional — hosts normally inject variables themselves. No secrets are ever committed (.env is git-ignored).
export function loadDotEnv(file, env = process.env) {
  if (!fs.existsSync(file)) return []
  const loaded = []
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(m[1] in env)) { env[m[1]] = v; loaded.push(m[1]) }
  }
  return loaded
}
loadDotEnv(path.join(ROOT, '.env'))
export const defaults = {
  port: Number(process.env.PORT || 3001),
  dataDir: process.env.DATA_DIR || path.join(here, 'data'),
  distDir: path.join(ROOT, 'dist'),
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024,
  seedDemoUsers: process.env.SEED_DEMO_USERS !== '0',
  timeZone: process.env.APP_TZ || 'Asia/Kolkata',
}
