import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { env } from './config/env.js'
import { adminRouter } from './routes/admin.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { paperRouter } from './routes/paper.routes.js'
import { profileRouter } from './routes/profile.routes.js'
import { hierarchyRouter } from './routes/hierarchy.routes.js'
import { generationRouter } from './routes/generation.routes.js'
import { requireCsrf } from './middleware/csrf.js'
import { prisma } from './lib/prisma.js'
import { compileOriginMatchers } from './utils/origin.js'
import { persistPermanentAdmin, RECAPP_ADMIN_EMAIL } from './services/auth.service.js'

const app = express()

// Render terminates TLS at its proxy, so the app has to trust the
// X-Forwarded-* headers to see the real protocol and host: `secure` cookies,
// request logs and any future rate limiting all depend on it.
app.set('trust proxy', 1)

// FRONTEND_ORIGIN may list several origins (custom domain, www, previews) and an
// entry may carry a `*` host wildcard for hosts that mint a new subdomain per
// deploy (see utils/origin.ts). Localhost stays allowed so the Vite dev server
// keeps working.
const allowedFrontendOrigins = compileOriginMatchers([
  ...env.frontendOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

// Same-origin and server-to-server calls send no Origin header at all; when a
// browser does send one it has to match the allow-list. Returning `false` leaves
// the response without Access-Control-Allow-Origin, which is what makes the
// browser block a disallowed origin — a rejected origin must never be reflected.
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedFrontendOrigins.some((matches) => matches(origin))),
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())
app.use(requireCsrf)

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'recappedu-backend' })
})

app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/hierarchy', hierarchyRouter)
app.use('/api', hierarchyRouter)
app.use('/api/admin', adminRouter)

app.use('/api/papers', paperRouter)
app.use('/api/generation', generationRouter)

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('[request-error]', error)
  response.status(500).json({ message: 'The server could not process the request.' })
})


app.listen(env.port, () => {
  console.log(`RecappEdu API listening on http://localhost:${env.port}`)
  // Make sure the main admin account always has admin rights, even if a prior
  // edit or a partial migration dropped the flag.
  prisma.profile
    .findUnique({ where: { email: RECAPP_ADMIN_EMAIL }, select: { id: true } })
    .then((admin) => { if (admin) return persistPermanentAdmin(admin.id) })
    .catch(() => { /* non-fatal */ })
})
