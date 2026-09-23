# RecappEdu frontend

React 19 + Vite 8 + TypeScript SPA, styled with Tailwind CSS v4.

Setup, environment variables, scripts and architecture notes all live in the
[root README](../README.md).

Quick start (from this directory):

```bash
npm install
npm run dev      # http://localhost:5173, expects the API on :4000
npm run build    # tsc -b && vite build
```

The API base URL comes from `VITE_API_URL`. `.env.production` is committed and
pins it to the deployed service, `https://reacappedu.onrender.com`, so
`npm run build` output always talks to production; a `VITE_API_URL` set in the
build environment (Vercel/Netlify/CI) wins over the file, and without either it
falls back to `http://localhost:4000` (see `src/lib/api.ts`). In development the
dev server proxies `/api` to the local API — set `VITE_PROXY_TARGET` in the shell
to run the app against the deployed API instead. Routing is hash-based — the
`Route` union in `src/types.ts` and the route table in `src/App.tsx` define
every screen, including the admin sub-pages (`#admin-users`, `#admin-activity`,
…).