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
const RECENT_FILTERS = ['all', '24h', '7d', '30d', '90d'] as const

/**
 * GET /api/admin/users — searchable, filterable and paginated so the board stays
 * snappy even with thousands of accounts. Filters: free-text search (name,
 * username, email), university/department, role (admin vs everyone) and a
 * "recent signups" quick filter (last 24h / 7d / 30d / 90d).
 */
export async function listUsers(request: Request, response: Response) {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : ''
  const universityId = typeof request.query.universityId === 'string' ? request.query.universityId : undefined
  const departmentId = typeof request.query.departmentId === 'string' ? request.query.departmentId : undefined
  const role = typeof request.query.role === 'string' ? request.query.role : 'all'
  const recent = (typeof request.query.recent === 'string' && (RECENT_FILTERS as readonly string[]).includes(request.query.recent)) ? request.query.recent : 'all'
  const page = parsePage(request.query.page, 1, 100000)
  const pageSize = parsePage(request.query.pageSize, 20, 100)
  const skip = (page - 1) * pageSize

  const identityFilters = search ? [
    { displayName: { contains: search, mode: 'insensitive' as const } },
    { username: { contains: search, mode: 'insensitive' as const } },
    { email: { contains: search, mode: 'insensitive' as const } },
    { referralCode: { contains: search.toUpperCase(), mode: 'insensitive' as const } },
  ] : []
  const hierarchyFilter = universityId || departmentId ? [{ papers: { some: { course: { department: { ...(departmentId ? { id: departmentId } : {}), ...(universityId ? { faculty: { universityId } } : {}) } } } } }] : []
  const roleFilter = role === 'admin' ? { isAdmin: true } : undefined
  const recentFilter = recent === 'all' ? undefined : { createdAt: { gte: new Date(Date.now() - ({ '24h': 24, '7d': 7, '30d': 30, '90d': 90 } as Record<string, number>)[recent] * 3600000) } }

  const where = {
    OR: [...identityFilters, ...hierarchyFilter].length > 0 ? [...identityFilters, ...hierarchyFilter] : undefined,
    papers: universityId || departmentId ? { some: { course: { department: { ...(departmentId ? { id: departmentId } : {}), ...(universityId ? { faculty: { universityId } } : {}) } } } } : undefined,
    ...roleFilter,
    ...recentFilter,
  }
  const [users, total] = await prisma.$transaction([
    prisma.profile.findMany({
      where,
      select: { id: true, email: true, displayName: true, username: true, isAdmin: true, tier: true, xp: true, referralCode: true, suspendedUntil: true, suspensionReason: true, createdAt: true, _count: { select: { generatedSets: true, papers: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.profile.count({ where }),
  ])
  response.json({ users, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } })
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

export async function listActivity(request: Request, response: Response) {
  const page = parsePage(request.query.page, 1, 100000)
  const pageSize = parsePage(request.query.pageSize, 25, 100)
  const skip = (page - 1) * pageSize
  const [activity, total] = await prisma.$transaction([
    prisma.auditEvent.findMany({
      include: { actor: { select: { id: true, email: true, displayName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditEvent.count(),
  ])
  response.json({ activity, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } })
}

// ── Promo codes (admin-issued premium / XP giveaways) ───────────────────────

/** GET /api/admin/promo-codes — every code with its live redemption count. */
export async function listPromoCodes(_request: Request, response: Response) {
  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { displayName: true, email: true } }, _count: { select: { redemptions: true } } },
  })
  response.json({
    codes: codes.map((code) => ({
      id: code.id, code: code.code, description: code.description, premiumDays: code.premiumDays, xpBonus: code.xpBonus,
      maxRedemptions: code.maxRedemptions, expiresAt: code.expiresAt, isActive: code.isActive, createdAt: code.createdAt,
      redemptionCount: code._count.redemptions,
      createdBy: code.createdBy?.displayName ?? code.createdBy?.email ?? null,
    })),
  })
}

/** POST /api/admin/promo-codes — issue a new code (what it grants + caps). */
export async function createPromoCode(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const body = request.body as { code?: string; description?: string; premiumDays?: number; xpBonus?: number; maxRedemptions?: number | null; expiresAt?: string | null }
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : ''
  if (code.length < 4) { response.status(400).json({ message: 'Use a code of at least 4 letters, numbers, dashes or underscores.' }); return }
  const premiumDays = Number(body.premiumDays ?? 0)
  const xpBonus = Number(body.xpBonus ?? 0)
  if (!Number.isInteger(premiumDays) || premiumDays < 0 || !Number.isInteger(xpBonus) || xpBonus < 0) { response.status(400).json({ message: 'Pro days and bonus XP must be whole numbers of 0 or more.' }); return }
  if (premiumDays === 0 && xpBonus === 0) { response.status(400).json({ message: 'Grant at least some Pro days or bonus XP.' }); return }
  const maxRedemptions = body.maxRedemptions == null || body.maxRedemptions === ('' as unknown) ? null : Number(body.maxRedemptions)
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) { response.status(400).json({ message: 'Max uses must be a whole number of 1 or more (or empty for unlimited).' }); return }
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) { response.status(400).json({ message: 'Expiry must be a date in the future.' }); return }
  try {
    const created = await prisma.promoCode.create({ data: { code, description: body.description?.trim() || null, premiumDays, xpBonus, maxRedemptions, expiresAt, createdById: actor.id } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'PROMO_CODE_CREATED', entityType: 'PromoCode', entityId: created.id, metadata: { code, premiumDays, xpBonus, maxRedemptions } } })
    response.status(201).json({ promo: created })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { response.status(409).json({ message: 'A code with those exact letters already exists.' }); return }
    response.status(500).json({ message: 'Could not create that code.' })
  }
}

/** PATCH /api/admin/promo-codes/:codeId — tweak the reward, caps or pause it. */
export async function updatePromoCode(request: Request, response: Response) {
  const codeId = routeParam(request, 'codeId')
  const body = request.body as Partial<{ description: string | null; premiumDays: number; xpBonus: number; maxRedemptions: number | null; expiresAt: string | null; isActive: boolean }>
  const data: Record<string, unknown> = {}
  if (body.description !== undefined) data.description = body.description?.trim() || null
  if (body.premiumDays !== undefined) { if (!Number.isInteger(body.premiumDays) || body.premiumDays < 0) { response.status(400).json({ message: 'Pro days must be a whole number of 0 or more.' }); return } data.premiumDays = body.premiumDays }
  if (body.xpBonus !== undefined) { if (!Number.isInteger(body.xpBonus) || body.xpBonus < 0) { response.status(400).json({ message: 'Bonus XP must be a whole number of 0 or more.' }); return } data.xpBonus = body.xpBonus }
  if (body.maxRedemptions !== undefined) data.maxRedemptions = body.maxRedemptions === null ? null : Number(body.maxRedemptions)
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
  try {
    const updated = await prisma.promoCode.update({ where: { id: codeId }, data })
    await prisma.auditEvent.create({ data: { actorId: (request as AuthenticatedRequest).profile.id, action: 'PROMO_CODE_UPDATED', entityType: 'PromoCode', entityId: updated.id, metadata: { code: updated.code, isActive: updated.isActive } } })
    response.json({ promo: updated })
  } catch { response.status(404).json({ message: 'Promo code not found.' }) }
}

/** DELETE /api/admin/promo-codes/:codeId — students who already used it keep their reward. */
export async function deletePromoCode(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const codeId = routeParam(request, 'codeId')
  try {
    const deleted = await prisma.promoCode.delete({ where: { id: codeId } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'PROMO_CODE_DELETED', entityType: 'PromoCode', entityId: deleted.id, metadata: { code: deleted.code } } })
    response.status(204).send()
  } catch { response.status(404).json({ message: 'Promo code not found.' }) }
}

// ── Missions (admin-managed challenges students claim XP from) ──────────────

export async function listMissions(_request: Request, response: Response) {
  const missions = await prisma.mission.findMany({ orderBy: { createdAt: 'desc' }, include: { claims: { select: { profileId: true } } } })
  response.json({ missions: missions.map((mission) => ({ id: mission.id, title: mission.title, description: mission.description, xpReward: mission.xpReward, isActive: mission.isActive, createdAt: mission.createdAt, claimCount: mission.claims.length })) })
}

export async function createMission(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const { title, description, xpReward } = request.body as { title?: string; description?: string; xpReward?: number }
  const cleanTitle = typeof title === 'string' ? title.trim() : ''
  const cleanDescription = typeof description === 'string' ? description.trim() : ''
  const reward = Number(xpReward)
  if (!cleanTitle || !Number.isInteger(reward) || reward <= 0 || reward > 1000) { response.status(400).json({ message: 'A mission title and an XP reward between 1 and 1000 are required.' }); return }
  const mission = await prisma.mission.create({ data: { title: cleanTitle, description: cleanDescription || null, xpReward: reward, createdById: actor.id } })
  await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'MISSION_CREATED', entityType: 'Mission', entityId: mission.id, metadata: { title: cleanTitle, xpReward: reward } } })
  response.status(201).json({ mission: { id: mission.id, title: mission.title, description: mission.description, xpReward: mission.xpReward, isActive: mission.isActive, createdAt: mission.createdAt, claimCount: 0 } })
}

export async function updateMission(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const missionId = routeParam(request, 'missionId')
  const { title, description, xpReward, isActive, active } = request.body as { title?: string; description?: string | null; xpReward?: number; isActive?: boolean; active?: boolean }
  const patch: { title?: string; description?: string | null; xpReward?: number; isActive?: boolean } = {}
  if (typeof title === 'string' && title.trim()) patch.title = title.trim()
  if (description !== undefined) patch.description = typeof description === 'string' && description.trim() ? description.trim() : null
  if (xpReward !== undefined && Number.isInteger(Number(xpReward)) && Number(xpReward) > 0 && Number(xpReward) <= 1000) patch.xpReward = Number(xpReward)
  if (typeof isActive === 'boolean') patch.isActive = isActive
  if (typeof active === 'boolean') patch.isActive = active
  if (Object.keys(patch).length === 0) { response.status(400).json({ message: 'Nothing to update.' }); return }
  try {
    const mission = await prisma.mission.update({ where: { id: missionId }, data: patch })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'MISSION_UPDATED', entityType: 'Mission', entityId: missionId, metadata: patch } })
    response.json({ mission })
  } catch { response.status(404).json({ message: 'Mission not found.' }) }
}

export async function deleteMission(request: Request, response: Response) {
  const actor = (request as AuthenticatedRequest).profile
  const missionId = routeParam(request, 'missionId')
  try {
    const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { title: true } })
    if (!mission) { response.status(404).json({ message: 'Mission not found.' }); return }
    await prisma.mission.delete({ where: { id: missionId } })
    await prisma.auditEvent.create({ data: { actorId: actor.id, action: 'MISSION_DELETED', entityType: 'Mission', entityId: missionId, metadata: { title: mission.title } } })
    response.status(204).send()
  } catch { response.status(500).json({ message: 'Could not delete that mission.' }) }
}
