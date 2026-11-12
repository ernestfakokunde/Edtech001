import { Router } from 'express'
import { askLearnTutor, readLearnDocument } from '../controllers/learn.controller.js'
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js'
import { chatLimit, uploadLimit } from '../middleware/rateLimit.js'
import { createDocumentUpload } from '../utils/upload.js'

const upload = createDocumentUpload()
export const learnRouter = Router()
learnRouter.use(requireAuth)
learnRouter.post('/document', uploadLimit, requireVerifiedEmail, upload.single('file'), readLearnDocument)
learnRouter.post('/chat', chatLimit, requireVerifiedEmail, askLearnTutor)
