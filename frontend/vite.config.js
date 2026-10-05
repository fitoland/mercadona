import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const backend = 'http://localhost:8000'

export default defineConfig({
  // Browsers only expose the camera on secure origins, so a tablet opening the
  // laptop's IP needs HTTPS: run with HTTPS=1.
  plugins: [react(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  server: {
    host: true,
    proxy: {
      '/api': backend,
      '/ws': { target: backend, ws: true },
    },
  },
})
