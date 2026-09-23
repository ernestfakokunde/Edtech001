import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The dev server proxies the API so browser requests stay same-origin: no CORS
// preflight (an extra round trip per state-changing call, login included) and
// the session cookie is set on the page's own origin. lib/api.ts uses a
// relative API base in development for the same reason.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
})
