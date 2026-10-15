import { createApp } from './app.js'
import { defaults } from './config.js'

if (process.env.NODE_ENV === 'production' && defaults.seedDemoUsers) {
  console.warn('WARNING: NODE_ENV=production but demo accounts are still enabled (their passwords are published in the README).\n' +
    '         Set SEED_DEMO_USERS=0 and create a real administrator with ADMIN_EMAIL + ADMIN_PASSWORD.')
}
const app = createApp()
app.listen(defaults.port, () => console.log(`TSEC Sync server on http://localhost:${defaults.port}  (data: ${defaults.dataDir})`))
