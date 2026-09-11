import { Router } from 'express'
import { updateProfile } from '../controllers/profile.controller.js'
import { requireAuth } from '../middleware/auth.js'

export const profileRouter = Router()
profileRouter.use(requireAuth)
profileRouter.patch('/', updateProfile)