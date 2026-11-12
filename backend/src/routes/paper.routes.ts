import { Router } from 'express'
import { deleteMyPaper, getPaperDownloadUrl, getRepositoryPaper, listMyPapers, listRepositoryPapers, submitPaper, updateMyPaper, uploadPaper } from '../controllers/paper.controller.js'
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js'
import { uploadLimit } from '../middleware/rateLimit.js'
import { createDocumentUpload } from '../utils/upload.js'

const upload = createDocumentUpload()

export const paperRouter = Router()
paperRouter.use(requireAuth)
paperRouter.post('/', uploadLimit, requireVerifiedEmail, upload.single('file'), uploadPaper)
paperRouter.get('/mine', listMyPapers)
paperRouter.get('/repository', listRepositoryPapers)
paperRouter.get('/repository/:paperId', getRepositoryPaper)
paperRouter.patch('/:paperId/submit', submitPaper)
paperRouter.patch('/:paperId', updateMyPaper)
paperRouter.delete('/:paperId', deleteMyPaper)
paperRouter.get('/:paperId/download', getPaperDownloadUrl)