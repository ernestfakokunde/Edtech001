import { Router } from 'express'
import { clearQuizAttempts, deleteQuizAttempt, generateStudySet, generationQuotaController, listGenerationProvidersController, listQuizAttempts, recordQuizAttempt } from '../controllers/generatedSet.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { createDocumentUpload } from '../utils/upload.js'

// Limits, accepted extensions and the 413/415 mapping live in utils/upload.ts
// so this route and the paper upload route can never drift apart.
const upload = createDocumentUpload()

export const generationRouter = Router()
generationRouter.use(requireAuth)
generationRouter.get('/providers', listGenerationProvidersController)
generationRouter.get('/quota', generationQuotaController)
generationRouter.get('/attempts', listQuizAttempts)
generationRouter.delete('/attempts', clearQuizAttempts)
generationRouter.delete('/attempts/:attemptId', deleteQuizAttempt)
generationRouter.post('/:setId/attempts', recordQuizAttempt)
generationRouter.post('/', upload.single('file'), generateStudySet)