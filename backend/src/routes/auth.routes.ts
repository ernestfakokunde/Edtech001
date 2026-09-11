import { Router } from 'express'
import { login, logout, me, signup } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { issueCsrfToken } from '../middleware/csrf.js'

export const authRouter = Router()

authRouter.get('/csrf', issueCsrfToken)
authRouter.post('/signup', signup)
authRouter.post('/login', login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, me)
