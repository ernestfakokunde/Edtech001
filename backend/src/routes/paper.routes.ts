import { Router } from 'express'
import multer from 'multer'
import { deleteMyPaper, getPaperDownloadUrl, getRepositoryPaper, listMyPapers, listRepositoryPapers, submitPaper, updateMyPaper, uploadPaper } from '../controllers/paper.controller.js'
import { requireAuth } from '../middleware/auth.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.toLowerCase().split('.').pop()
    const accepted = ['pdf', 'doc', 'docx'].includes(extension ?? '')
    callback(null, accepted)
  },
})

export const paperRouter = Router()
paperRouter.use(requireAuth)
paperRouter.post('/', upload.single('file'), uploadPaper)
paperRouter.get('/mine', listMyPapers)
paperRouter.get('/repository', listRepositoryPapers)
paperRouter.get('/repository/:paperId', getRepositoryPaper)
paperRouter.patch('/:paperId/submit', submitPaper)
paperRouter.patch('/:paperId', updateMyPaper)
paperRouter.delete('/:paperId', deleteMyPaper)
paperRouter.get('/:paperId/download', getPaperDownloadUrl)