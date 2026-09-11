import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

function routeParam(request: Request, name: string) {
  const value = request.params[name]
  return Array.isArray(value) ? value[0] : value
}

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

export async function listRepositorySubmissions(_request: Request, response: Response) {
  const submissions = await prisma.paper.findMany({
    where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
    include: { owner: { select: { id: true, email: true, displayName: true, username: true } }, course: true },
    orderBy: { createdAt: 'desc' },
  })
  response.json({ submissions })
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
