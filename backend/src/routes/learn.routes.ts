import { Router } from 'express'
import { askLearnTutor, readLearnDocument } from '../controllers/learn.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { createDocumentUpload } from '../utils/upload.js'

const upload = createDocumentUpload()
export const learnRouter = Router()
learnRouter.use(requireAuth)
learnRouter.post('/document', upload.single('file'), readLearnDocument)
learnRouter.post('/chat', askLearnTutor)
