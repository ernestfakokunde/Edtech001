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

const app = express()

const localFrontendOrigins = new Set([
  env.frontendOrigin,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || localFrontendOrigins.has(origin)),
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
})
