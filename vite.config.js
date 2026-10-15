import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `npm run dev` (UI on :5173) + `npm run server` (API on :3001); /api is proxied to the server.
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    exclude: ['node_modules/**', 'dist/**', 'server/**'], // server tests run with node:test (npm run test:server)
  },
})
