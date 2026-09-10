import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { env } from './config/env.js'
import { adminRouter } from './routes/admin.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { paperRouter } from './routes/paper.routes.js'

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

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'recappedu-backend' })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)

app.use('/api/universities', (_request, response) => response.status(501).json({ message: 'University routes pending implementation' }))
app.use('/api/faculties', (_request, response) => response.status(501).json({ message: 'Faculty routes pending implementation' }))
app.use('/api/departments', (_request, response) => response.status(501).json({ message: 'Department routes pending implementation' }))
app.use('/api/courses', (_request, response) => response.status(501).json({ message: 'Course routes pending implementation' }))
app.use('/api/papers', paperRouter)
app.use('/api/generation', (_request, response) => response.status(501).json({ message: 'Generation routes pending implementation' }))

app.listen(env.port, () => {
  console.log(`RecappEdu API listening on http://localhost:${env.port}`)
})
