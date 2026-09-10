import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { supabase } from '../lib/supabase.js'

function getProfile(request: Request) {
  return (request as AuthenticatedRequest).profile
}

function storagePath(course: { department: { faculty: { university: { slug: string }; slug: string }; slug: string }; code: string }, paperId: string) {
  const { department } = course
  return `${department.faculty.university.slug}/${department.faculty.slug}/${department.slug}/${course.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${paperId}.pdf`
}

export async function uploadPaper(request: Request, response: Response) {
  const file = (request as Request & { file?: Express.Multer.File }).file
  const { courseId, session, year, semester } = request.body as Partial<{ courseId: string; session: string; year: string; semester: string }>

  if (!file || file.mimetype !== 'application/pdf') { response.status(400).json({ message: 'A PDF file is required.' }); return }
  const parsedYear = Number(year)
  if (!courseId || !session || !Number.isInteger(parsedYear) || parsedYear < 1900 || !['FIRST', 'SECOND'].includes(semester ?? '')) { response.status(400).json({ message: 'courseId, session, a valid year, and semester are required.' }); return }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) { response.status(503).json({ message: 'Supabase Storage is not configured.' }); return }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { department: { include: { faculty: { include: { university: true } } } } },
  })
  if (!course) { response.status(404).json({ message: 'Course not found.' }); return }

  const paper = await prisma.paper.create({
    data: { ownerId: getProfile(request).id, courseId, session, year: parsedYear, semester: semester as 'FIRST' | 'SECOND', fileUrl: '' },
  })
  const path = storagePath(course, paper.id)

  const { error } = await supabase.storage.from(env.supabaseBucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: false })
  if (error) {
    await prisma.paper.delete({ where: { id: paper.id } })
    response.status(502).json({ message: `Could not upload paper: ${error.message}` }); return
  }

  const savedPaper = await prisma.paper.update({ where: { id: paper.id }, data: { fileUrl: path } })
  response.status(201).json({ paper: savedPaper })
}

export async function getPaperDownloadUrl(request: Request, response: Response) {
  const paperId = Array.isArray(request.params.paperId) ? request.params.paperId[0] : request.params.paperId
  const paper = await prisma.paper.findUnique({ where: { id: paperId } })
  if (!paper) { response.status(404).json({ message: 'Paper not found.' }); return }

  const profile = getProfile(request)
  const canDownload = paper.ownerId === profile.id || (paper.visibility === 'PUBLIC' && paper.status === 'APPROVED')
  if (!canDownload) { response.status(403).json({ message: 'You do not have access to this paper.' }); return }

  const { data, error } = await supabase.storage.from(env.supabaseBucket).createSignedUrl(paper.fileUrl, 60 * 10)
  if (error) { response.status(502).json({ message: `Could not create download link: ${error.message}` }); return }
  response.json({ url: data.signedUrl })
}