import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The dev server proxies the API so browser requests stay same-origin: no CORS
// preflight (an extra round trip per state-changing call, login included) and
// the session cookie is set on the page's own origin. lib/api.ts uses a
// relative API base in development for the same reason.
//
// VITE_PROXY_TARGET defaults to the local API. Point it at a deployed service
// (VITE_PROXY_TARGET=https://reacappedu.onrender.com npm run dev) to develop
// against production with the same-origin path intact.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000'

// A remote target must receive its own Host header or the edge cannot route the
// request; a local target is left untouched so LAN/other dev servers keep working.
const isRemoteTarget = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(proxyTarget)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: isRemoteTarget,
      },
    },
  },
})
