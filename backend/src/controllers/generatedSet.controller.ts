import type { Request , Response } from 'express'
import { getProfileBySession } from '../services/auth.service.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { supabase } from '../lib/supabase.js'

export async function generateStudySet(request: Request, response: Response) {
    const { profile } = request as AuthenticatedRequest
    const file = (request as AuthenticatedRequest & { file?: Express.Multer.File}).file

    if(!file){
        response.status(400).json({ message: 'No file uploaded.A file is required.' })
        return
    }

    const { courseId, type, length, timePerQuestion } request.body as partial<{
        courseId: string
        type: 'FLASHCARD' | 'QUIZ'
        length: string
        timePerQuestion: string
    }>

    if(!courseId || (type !== 'FLASHCARD' && type !== 'QUIZ') || !length){
        response.status(400).json({ message: 'courseId, type, length are required.' })
        return
    }
}