import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { supabase } from '../lib/supabase.js'

function getProfile(request: Request) {
  return (request as AuthenticatedRequest).profile
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function fileExtension(file: Express.Multer.File) {
  const extension = file.originalname.toLowerCase().split('.').pop()
  return extension === 'pdf' || extension === 'doc' || extension === 'docx' ? extension : null
}

function storagePath(course: { department: { faculty: { university: { slug: string }; slug: string }; slug: string }; code: string }, paperId: string, extension: string) {
  const { department } = course
  return `${department.faculty.university.slug}/${department.faculty.slug}/${department.slug}/${course.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${paperId}.${extension}`
}

function positiveInt(value: unknown, fallback: number, maximum: number) {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

export async function uploadPaper(request: Request, response: Response) {
  const file = (request as Request & { file?: Express.Multer.File }).file
  const { courseId, universityName, facultyName, courseTitle, courseCode, description, level, session, year, semester } = request.body as Partial<{ courseId: string; universityName: string; facultyName: string; courseTitle: string; courseCode: string; description: string; level: string; session: string; year: string; semester: string }>

  const extension = file ? fileExtension(file) : null
  if (!file || !extension) { response.status(400).json({ message: 'A PDF or Word document is required.' }); return }
  const parsedYear = Number(year)
  const hasTypedCourse = Boolean(universityName?.trim() && facultyName?.trim() && courseTitle?.trim() && courseCode?.trim())
  if ((!courseId && !hasTypedCourse) || !description?.trim() || !level?.trim() || !session || !Number.isInteger(parsedYear) || parsedYear < 1900 || !['FIRST', 'SECOND'].includes(semester ?? '')) { response.status(400).json({ message: 'University, faculty, course name, course code, description, level, session, year, and semester are required.' }); return }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) { response.status(503).json({ message: 'Supabase Storage is not configured.' }); return }

  const course = courseId ? await prisma.course.findUnique({ where: { id: courseId }, include: { department: { include: { faculty: { include: { university: true } } } } } }) : await prisma.$transaction(async (transaction) => {
    const university = await transaction.university.upsert({ where: { slug: slugify(universityName!) }, update: { name: universityName!.trim() }, create: { name: universityName!.trim(), slug: slugify(universityName!) } })
    const faculty = await transaction.faculty.upsert({ where: { universityId_slug: { universityId: university.id, slug: slugify(facultyName!) } }, update: { name: facultyName!.trim() }, create: { universityId: university.id, name: facultyName!.trim(), slug: slugify(facultyName!) } })
    const department = await transaction.department.upsert({ where: { facultyId_slug: { facultyId: faculty.id, slug: 'general' } }, update: {}, create: { facultyId: faculty.id, name: 'General', slug: 'general' } })
    return transaction.course.upsert({ where: { departmentId_code: { departmentId: department.id, code: courseCode!.trim().toUpperCase() } }, update: { title: courseTitle!.trim() }, create: { departmentId: department.id, code: courseCode!.trim().toUpperCase(), title: courseTitle!.trim() }, include: { department: { include: { faculty: { include: { university: true } } } } } })
  }, { maxWait: 10000, timeout: 15000 })
  if (!course) { response.status(404).json({ message: 'Course not found.' }); return }

  const paper = await prisma.paper.create({
    data: { ownerId: getProfile(request).id, courseId: course.id, description: description.trim(), level: level.trim(), session, year: parsedYear, semester: semester as 'FIRST' | 'SECOND', fileUrl: '' },
  })
  const path = storagePath(course, paper.id, extension)

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
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey || !paper.fileUrl) { response.status(503).json({ message: 'Paper storage is not configured.' }); return }

  const { data, error } = await supabase.storage.from(env.supabaseBucket).createSignedUrl(paper.fileUrl, 60 * 10)
  if (error) { response.status(502).json({ message: `Could not create download link: ${error.message}` }); return }
  response.json({ url: data.signedUrl })
}

export async function submitPaper(request: Request, response: Response) {
  const paperId = Array.isArray(request.params.paperId) ? request.params.paperId[0] : request.params.paperId
  const ownerId = getProfile(request).id
  const paper = await prisma.paper.findFirst({ where: { id: paperId, ownerId } })
  if (!paper) { response.status(404).json({ message: 'Private paper not found.' }); return }
  if (paper.status !== 'DRAFT' && paper.status !== 'REJECTED') { response.status(400).json({ message: 'This paper is already in the repository review flow.' }); return }
  const updatedPaper = await prisma.paper.update({ where: { id: paper.id }, data: { status: 'PENDING', visibility: 'PUBLIC' }, include: { course: { select: { id: true, code: true, title: true } } } })
  await prisma.auditEvent.create({ data: { actorId: ownerId, action: 'PAPER_SUBMITTED', entityType: 'Paper', entityId: paper.id } })
  response.json({ paper: updatedPaper })
}

export async function listMyPapers(request: Request, response: Response) {
  const ownerId = getProfile(request).id
  const page = positiveInt(request.query.page, 1, 100000)
  const pageSize = positiveInt(request.query.pageSize, 20, 100)
  const where = { ownerId }
  const [papers, total] = await Promise.all([
    prisma.paper.findMany({ where, include: { course: { select: { id: true, code: true, title: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.paper.count({ where }),
  ])
  response.json({ papers, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } })
}

export async function updateMyPaper(request: Request, response: Response) {
  const ownerId = getProfile(request).id
  const paperId = Array.isArray(request.params.paperId) ? request.params.paperId[0] : request.params.paperId
  const paper = await prisma.paper.findFirst({ where: { id: paperId, ownerId } })
  if (!paper) { response.status(404).json({ message: 'Private paper not found.' }); return }
  if (paper.status === 'PENDING' || paper.status === 'APPROVED') { response.status(400).json({ message: 'This paper cannot be edited while it is in the repository.' }); return }
  const { description, level, session, year, semester } = request.body as Partial<{ description: string; level: string; session: string; year: number; semester: string }>
  const parsedYear = Number(year)
  if (!description?.trim() || !level?.trim() || !session?.trim() || !Number.isInteger(parsedYear) || !['FIRST', 'SECOND'].includes(semester ?? '')) { response.status(400).json({ message: 'Description, level, session, year, and semester are required.' }); return }
  const updatedPaper = await prisma.paper.update({ where: { id: paper.id }, data: { description: description.trim(), level: level.trim(), session: session.trim(), year: parsedYear, semester: semester as 'FIRST' | 'SECOND' }, include: { course: { select: { id: true, code: true, title: true } } } })
  response.json({ paper: updatedPaper })
}

export async function deleteMyPaper(request: Request, response: Response) {
  const ownerId = getProfile(request).id
  const paperId = Array.isArray(request.params.paperId) ? request.params.paperId[0] : request.params.paperId
  const paper = await prisma.paper.findFirst({ where: { id: paperId, ownerId } })
  if (!paper) { response.status(404).json({ message: 'Private paper not found.' }); return }
  if (paper.status === 'PENDING' || paper.status === 'APPROVED') { response.status(400).json({ message: 'This paper cannot be deleted while it is in the repository.' }); return }
  if (env.supabaseUrl && env.supabaseServiceRoleKey && paper.fileUrl) {
    const { error } = await supabase.storage.from(env.supabaseBucket).remove([paper.fileUrl])
    if (error) { response.status(502).json({ message: `Could not remove paper file: ${error.message}` }); return }
  }
  await prisma.paper.delete({ where: { id: paper.id } })
  response.status(204).send()
}

export async function listRepositoryPapers(request: Request, response: Response) {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : undefined
  const level = typeof request.query.level === 'string' ? request.query.level.trim() : undefined
  const courseId = typeof request.query.courseId === 'string' ? request.query.courseId : undefined
  const universityId = typeof request.query.universityId === 'string' ? request.query.universityId : undefined
  const facultyId = typeof request.query.facultyId === 'string' ? request.query.facultyId : undefined
  const departmentId = typeof request.query.departmentId === 'string' ? request.query.departmentId : undefined
  const page = positiveInt(request.query.page, 1, 100000)
  const pageSize = positiveInt(request.query.pageSize, 20, 100)
  const departmentFilter = departmentId || facultyId || universityId ? {
    ...(departmentId ? { id: departmentId } : {}),
    ...(facultyId || universityId ? { faculty: { ...(facultyId ? { id: facultyId } : {}), ...(universityId ? { universityId } : {}) } } : {}),
  } : undefined
  const courseFilter = courseId || departmentFilter ? { ...(courseId ? { id: courseId } : {}), ...(departmentFilter ? { department: departmentFilter } : {}) } : undefined
  const where = {
    status: 'APPROVED' as const,
    visibility: 'PUBLIC' as const,
    ...(level ? { level: { equals: level, mode: 'insensitive' as const } } : {}),
    ...(courseFilter ? { course: courseFilter } : {}),
    ...(search ? { OR: [{ description: { contains: search, mode: 'insensitive' as const } }, { course: { code: { contains: search, mode: 'insensitive' as const } } }, { course: { title: { contains: search, mode: 'insensitive' as const } } }, { course: { department: { name: { contains: search, mode: 'insensitive' as const } } } }] } : {}),
  }
  const papers = await prisma.paper.findMany({
    where,
    include: { course: { select: { id: true, code: true, title: true } }, owner: { select: { displayName: true, username: true } } }, orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
  const total = await prisma.paper.count({ where })
  response.json({ papers, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } })
}

export async function getRepositoryPaper(request: Request, response: Response) {
  const paperId = Array.isArray(request.params.paperId) ? request.params.paperId[0] : request.params.paperId
  const paper = await prisma.paper.findFirst({
    where: { id: paperId, status: 'APPROVED', visibility: 'PUBLIC' },
    include: { course: { select: { id: true, code: true, title: true } }, owner: { select: { displayName: true, username: true } } },
  })
  if (!paper) { response.status(404).json({ message: 'Repository material not found.' }); return }
  response.json({ paper })
}