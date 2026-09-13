import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

function routeParam(request: Request, name: string) {
  const value = request.params[name]
  return Array.isArray(value) ? value[0] : value
}

function parsePage(value: unknown, fallback: number, maximum: number) {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

const SUBMISSION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export async function listUsers(request: Request, response: Response) {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : ''
  const universityId = typeof request.query.universityId === 'string' ? request.query.universityId : undefined
  const departmentId = typeof request.query.departmentId === 'string' ? request.query.departmentId : undefined
  const identityFilters = search ? [
    { displayName: { contains: search, mode: 'insensitive' as const } },
    { username: { contains: search, mode: 'insensitive' as const } },
    { email: { contains: search, mode: 'insensitive' as const } },
  ] : []
  const hierarchyFilter = universityId || departmentId ? [{ papers: { some: { course: { department: { ...(departmentId ? { id: departmentId } : {}), ...(universityId ? { faculty: { universityId } } : {}) } } } } }] : []
  const users = await prisma.profile.findMany({
    where: {
      OR: [...identityFilters, ...hierarchyFilter].length > 0 ? [...identityFilters, ...hierarchyFilter] : undefined,
      papers: universityId || departmentId ? { some: { course: { department: { ...(departmentId ? { id: departmentId } : {}), ...(universityId ? { faculty: { universityId } } : {}) } } } } : undefined,
    },
    select: { id: true, email: true, displayName: true, username: true, isAdmin: true, suspendedUntil: true, suspensionReason: true, createdAt: true, _count: { select: { generatedSets: true, papers: true } } },
    orderBy: { createdAt: 'desc' },
  })
  response.json({ users })
}

export async function suspendUser(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const userId = routeParam(request, 'userId')
  const { until, reason } = request.body as { until?: string; reason?: string }
  const suspendedUntil = until ? new Date(until) : null
  if (!suspendedUntil || Number.isNaN(suspendedUntil.getTime()) || suspendedUntil <= new Date()) { response.status(400).json({ message: 'A future suspension date is required.' }); return }
  if (userId === actor.id) { response.status(400).json({ message: 'You cannot suspend your own admin account.' }); return }
  try {
    const user = await prisma.profile.update({ where: { id: userId }, data: { suspendedUntil, suspensionReason: reason?.trim() || null }, select: { id: true, suspendedUntil: true, suspensionReason: true } })
    await prisma.session.deleteMany({ where: { profileId: userId } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'USER_SUSPENDED', entityType: 'Profile', entityId: userId, metadata: { until: suspendedUntil.toISOString(), reason: reason?.trim() || null } } })
    response.json({ user })
  } catch { response.status(404).json({ message: 'User not found.' }) }
}

export async function unsuspendUser(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const userId = routeParam(request, 'userId')
  try {
    const user = await prisma.profile.update({ where: { id: userId }, data: { suspendedUntil: null, suspensionReason: null }, select: { id: true, suspendedUntil: true, suspensionReason: true } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'USER_UNSUSPENDED', entityType: 'Profile', entityId: userId } })
    response.json({ user })
  } catch { response.status(404).json({ message: 'User not found.' }) }
}

export async function listHierarchyActivity(_request: Request, response: Response) {
  const activity = await prisma.auditEvent.findMany({
    where: { entityType: { in: ['University', 'Faculty', 'Department', 'Course'] } },
    include: { actor: { select: { id: true, email: true, displayName: true, username: true } } },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  response.json({ activity })
}

export async function listRepositorySubmissions(request: Request, response: Response) {
  const status = typeof request.query.status === 'string' && SUBMISSION_STATUSES.includes(request.query.status.toUpperCase() as (typeof SUBMISSION_STATUSES)[number])
    ? (request.query.status.toUpperCase() as (typeof SUBMISSION_STATUSES)[number])
    : 'PENDING'
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : undefined
  const page = parsePage(request.query.page, 1, 100)
  const pageSize = parsePage(request.query.pageSize, 50, 100)
  const skip = (page - 1) * pageSize

  const where: Prisma.PaperWhereInput = {
    status,
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: 'insensitive' } },
            { course: { code: { contains: search, mode: 'insensitive' } } },
            { course: { title: { contains: search, mode: 'insensitive' } } },
            { owner: { displayName: { contains: search, mode: 'insensitive' } } },
            { owner: { username: { contains: search, mode: 'insensitive' } } },
            { owner: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [submissions, total] = await prisma.$transaction([
    prisma.paper.findMany({ where, include: { owner: { select: { id: true, email: true, displayName: true, username: true } }, course: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    prisma.paper.count({ where }),
  ])

  response.json({
    submissions,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
  })
}

export async function moderationSummary(_request: Request, response: Response) {
  const [pending, approved, rejected, generatedSets, users] = await prisma.$transaction([
    prisma.paper.count({ where: { status: 'PENDING' } }),
    prisma.paper.count({ where: { status: 'APPROVED' } }),
    prisma.paper.count({ where: { status: 'REJECTED' } }),
    prisma.generatedSet.count(),
    prisma.profile.count(),
  ])
  response.json({ summary: { pending, approved, rejected, generatedSets, users } })
}

export async function reviewRepositorySubmission(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const paperId = routeParam(request, 'paperId')
  const { decision, note } = request.body as { decision?: string; note?: string }
  if (decision !== 'APPROVED' && decision !== 'REJECTED') { response.status(400).json({ message: 'A valid review decision is required.' }); return }
  try {
    const existingPaper = await prisma.paper.findUnique({ where: { id: paperId } })
    if (!existingPaper || existingPaper.status !== 'PENDING') { response.status(409).json({ message: 'Only pending submissions can be reviewed.' }); return }
    const paper = await prisma.paper.update({ where: { id: paperId }, data: { status: decision, visibility: decision === 'APPROVED' ? 'PUBLIC' : 'PRIVATE', reviewedAt: new Date(), reviewedBy: actor.id, reviewNote: note?.trim() || null }, include: { course: true } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: `PAPER_${decision}`, entityType: 'Paper', entityId: paper.id, metadata: { note: note?.trim() || null } } })
    response.json({ paper })
  } catch { response.status(404).json({ message: 'Paper submission not found.' }) }
}

export async function listActivity(_request: Request, response: Response) {
  const activity = await prisma.auditEvent.findMany({
    include: { actor: { select: { id: true, email: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  response.json({ activity })
}
