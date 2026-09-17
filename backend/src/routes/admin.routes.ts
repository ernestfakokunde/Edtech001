import { Router } from 'express'
import { createMission, createPromoCode, deleteMission, deletePromoCode, listActivity, listHierarchyActivity, listMissions, listPromoCodes, listRepositorySubmissions, listUsers, moderationSummary, promoteToAdmin, reviewRepositorySubmission, suspendUser, unsuspendUser, updateMission, updatePromoCode } from '../controllers/admin.controller.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/users', listUsers)
adminRouter.post('/users/promote', promoteToAdmin)
adminRouter.patch('/users/:userId/suspend', suspendUser)
adminRouter.patch('/users/:userId/unsuspend', unsuspendUser)
adminRouter.get('/repository-submissions', listRepositorySubmissions)
adminRouter.patch('/repository-submissions/:paperId', reviewRepositorySubmission)
adminRouter.get('/moderation/summary', moderationSummary)
adminRouter.get('/activity', listActivity)
adminRouter.get('/hierarchy-activity', listHierarchyActivity)
adminRouter.get('/missions', listMissions)
adminRouter.post('/missions', createMission)
adminRouter.patch('/missions/:missionId', updateMission)
adminRouter.delete('/missions/:missionId', deleteMission)
adminRouter.get('/promo-codes', listPromoCodes)
adminRouter.post('/promo-codes', createPromoCode)
adminRouter.patch('/promo-codes/:codeId', updatePromoCode)
adminRouter.delete('/promo-codes/:codeId', deletePromoCode)
