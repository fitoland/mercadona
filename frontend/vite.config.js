import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { existsSync, readFileSync } from 'node:fs'

const backend = 'http://127.0.0.1:8000'

export default defineConfig(({ mode }) => {
  const mobile = Boolean(process.env.HTTPS || mode === 'mobile')
  const trusted = existsSync('./certs/local.pem') && existsSync('./certs/local-key.pem')
  return {
    plugins: [react(), ...(mobile && !trusted ? [basicSsl()] : [])],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      ...(mobile && trusted ? { https: {
        cert: readFileSync('./certs/local.pem'), key: readFileSync('./certs/local-key.pem'),
      } } : {}),
      proxy: { '/api': backend, '/ws': { target: backend, ws: true } },
    },
  }
})
