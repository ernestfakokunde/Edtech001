import { Router } from 'express'
import { addMyCourse, claimMission, deleteAccount, getReferralInfo, getXp, listMissions, listMyCourses, redeemPromoCode, removeMyCourse, saveSchool, updateProfile } from '../controllers/profile.controller.js'
import { requireAuth } from '../middleware/auth.js'

export const profileRouter = Router()
profileRouter.use(requireAuth)
profileRouter.put('/school', saveSchool)
profileRouter.get('/courses', listMyCourses)
profileRouter.post('/courses', addMyCourse)
profileRouter.delete('/courses/:courseId', removeMyCourse)
profileRouter.patch('/', updateProfile)
profileRouter.post('/redeem', redeemPromoCode)
profileRouter.get('/referral', getReferralInfo)
profileRouter.get('/missions', listMissions)
profileRouter.post('/missions/:missionId/claim', claimMission)
profileRouter.get('/xp', getXp)
profileRouter.delete('/', deleteAccount)