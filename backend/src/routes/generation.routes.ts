import { Router } from 'express'
import multer from 'multer'
import { generateStudySet, listGenerationProvidersController } from '../controllers/generatedSet.controller.js'
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
generationRouter.post('/', upload.single('file'), generateStudySet)