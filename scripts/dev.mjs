// Starts the API server and the Vite UI together:  npm run dev:all
import { spawn } from 'node:child_process'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`\nNode ${process.version} is too old. The API needs Node 22.5 or newer (built-in SQLite). Install Node 22+ from nodejs.org and retry.\n`)
  process.exit(1)
}
const run = (name, args) => {
  const p = spawn(process.execPath, args, { stdio: 'inherit' })
  p.on('exit', code => { console.error(`[${name}] exited (${code})`); stop(code || 0) })
  return p
}
const children = [
  run('api', ['--no-warnings', 'server/index.js']),
  run('ui', ['node_modules/vite/bin/vite.js']),
]
function stop(code) { children.forEach(c => c.kill()); process.exit(code) }
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
