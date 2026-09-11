import { Router } from 'express'
import { listActivity, listHierarchyActivity, listRepositorySubmissions, listUsers, reviewRepositorySubmission, suspendUser, unsuspendUser } from '../controllers/admin.controller.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/users', listUsers)
adminRouter.patch('/users/:userId/suspend', suspendUser)
adminRouter.patch('/users/:userId/unsuspend', unsuspendUser)
adminRouter.get('/repository-submissions', listRepositorySubmissions)
adminRouter.patch('/repository-submissions/:paperId', reviewRepositorySubmission)
adminRouter.get('/activity', listActivity)
adminRouter.get('/hierarchy-activity', listHierarchyActivity)
