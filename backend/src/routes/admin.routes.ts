import { Router } from 'express'
import { listActivity, listRepositorySubmissions, listUsers } from '../controllers/admin.controller.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/users', listUsers)
adminRouter.get('/repository-submissions', listRepositorySubmissions)
adminRouter.get('/activity', listActivity)
