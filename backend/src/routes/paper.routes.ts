import { Router } from 'express'
import multer from 'multer'
import { getPaperDownloadUrl, uploadPaper } from '../controllers/paper.controller.js'
import { requireAuth } from '../middleware/auth.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
})

export const paperRouter = Router()
paperRouter.use(requireAuth)
paperRouter.post('/', upload.single('file'), uploadPaper)
paperRouter.get('/:paperId/download', getPaperDownloadUrl)