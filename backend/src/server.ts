import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'

const app = express()

app.use(cors({ origin: env.frontendOrigin }))
app.use(express.json())

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'recappedu-backend' })
})

app.use('/api/universities', (_request, response) => response.status(501).json({ message: 'University routes pending implementation' }))
app.use('/api/faculties', (_request, response) => response.status(501).json({ message: 'Faculty routes pending implementation' }))
app.use('/api/departments', (_request, response) => response.status(501).json({ message: 'Department routes pending implementation' }))
app.use('/api/courses', (_request, response) => response.status(501).json({ message: 'Course routes pending implementation' }))
app.use('/api/papers', (_request, response) => response.status(501).json({ message: 'Paper routes pending implementation' }))
app.use('/api/generation', (_request, response) => response.status(501).json({ message: 'Generation routes pending implementation' }))

app.listen(env.port, () => {
  console.log(`RecappEdu API listening on http://localhost:${env.port}`)
})
