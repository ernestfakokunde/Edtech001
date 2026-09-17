import { Router } from 'express'
import multer from 'multer'
import { clearQuizAttempts, deleteQuizAttempt, generateStudySet, generationQuotaController, listGenerationProvidersController, listQuizAttempts, recordQuizAttempt } from '../controllers/generatedSet.controller.js'
import { requireAuth } from '../middleware/auth.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.toLowerCase().split('.').pop()
    callback(null, ['pdf', 'doc', 'docx'].includes(extension ?? ''))
  },
})

export const generationRouter = Router()
generationRouter.use(requireAuth)
generationRouter.get('/providers', listGenerationProvidersController)
generationRouter.get('/quota', generationQuotaController)
generationRouter.get('/attempts', listQuizAttempts)
generationRouter.delete('/attempts', clearQuizAttempts)
generationRouter.delete('/attempts/:attemptId', deleteQuizAttempt)
generationRouter.post('/:setId/attempts', recordQuizAttempt)
generationRouter.post('/', upload.single('file'), generateStudySet)