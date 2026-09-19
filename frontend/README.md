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

The API base URL is read from `VITE_API_URL` and defaults to
`http://localhost:4000` (see `src/lib/api.ts`). Routing is hash-based — the
`Route` union in `src/types.ts` and the route table in `src/App.tsx` define
every screen, including the admin sub-pages (`#admin-users`, `#admin-activity`,
…).