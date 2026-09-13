import { Router } from 'express'
import { addMyCourse, listMyCourses, removeMyCourse, saveSchool, updateProfile } from '../controllers/profile.controller.js'
import { requireAuth } from '../middleware/auth.js'

export const profileRouter = Router()
profileRouter.use(requireAuth)
profileRouter.put('/school', saveSchool)
profileRouter.get('/courses', listMyCourses)
profileRouter.post('/courses', addMyCourse)
profileRouter.delete('/courses/:courseId', removeMyCourse)
profileRouter.patch('/', updateProfile)