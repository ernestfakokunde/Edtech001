import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { supabase } from '../lib/supabase.js'
import { env } from '../config/env.js'
import { slugify } from '../utils/course.js'

/**
 * How many courses a student can keep on their profile for quick personal
 * uploads and AI generation. The shared Course entity is never deleted when a
 * saved course is removed — only the student's link to it.
 */
const MAX_SAVED_COURSES = 10

function getProfile(request: Request) {
  return (request as AuthenticatedRequest).profile
}

function recordProfileAudit(request: Request, action: string, entityType: string, entityId: string, metadata?: object) {
  return prisma.auditEvent.create({ data: { actorId: getProfile(request).id, action, entityType, entityId, metadata } })
}

function cleanInput(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isControlFlow(error: unknown, message: string) {
  return error instanceof Error && error.message === message
}

/**
 * PUT /api/profile/school — the student enters their university and faculty
 * once. Both are resolve-or-create by slug (mirroring the typed-course flow in
 * utils/course.ts), so re-entering the same names never duplicates rows and
 * existing hierarchy entries are matched case-insensitively.
 */
export async function saveSchool(request: Request, response: Response) {
  const profileId = getProfile(request).id
  const universityName = cleanInput(request.body?.universityName)
  const facultyName = cleanInput(request.body?.facultyName)
  if (!universityName || !facultyName) {
    response.status(400).json({ message: 'University and faculty names are required.' })
    return
  }

  try {
    const school = await prisma.$transaction(
      async (transaction) => {
        const university = await transaction.university.upsert({
          where: { slug: slugify(universityName) },
          update: { name: universityName },
          create: { name: universityName, slug: slugify(universityName) },
        })
        const faculty = await transaction.faculty.upsert({
          where: { universityId_slug: { universityId: university.id, slug: slugify(facultyName) } },
          update: { name: facultyName },
          create: { universityId: university.id, name: facultyName, slug: slugify(facultyName) },
        })
        await transaction.profile.update({ where: { id: profileId }, data: { universityId: university.id, facultyId: faculty.id } })
        return { universityName: university.name, facultyName: faculty.name }
      },
      { maxWait: 10000, timeout: 15000 },
    )
    await recordProfileAudit(request, 'PROFILE_SCHOOL_SAVED', 'Profile', profileId, school)
    response.json({ school })
  } catch {
    response.status(500).json({ message: 'Could not save your school details.' })
  }
}

export async function updateProfile(request: Request, response: Response) {
  const profile = (request as AuthenticatedRequest).profile
  const { displayName, username } = request.body as Partial<{ displayName: string; username: string }>
  const cleanDisplayName = displayName?.trim()
  const cleanUsername = username?.trim().toLowerCase()

  if (!cleanDisplayName || !cleanUsername || !/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
    response.status(400).json({ message: 'Display name and a username using 3-24 letters, numbers, or underscores are required.' })
    return
  }

  try {
    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: { displayName: cleanDisplayName, username: cleanUsername },
      select: { id: true, email: true, displayName: true, username: true, isAdmin: true },
    })
    response.json({ profile: updatedProfile })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      response.status(409).json({ message: 'That username is already taken.' })
      return
    }
    response.status(500).json({ message: 'Could not update your profile.' })
  }
}

/**
 * GET /api/profile/courses — the saved school (null until PUT /school runs)
 * plus the student's saved courses. Used by both Profile and the Generate
 * picker, so neither has to walk the university → faculty hierarchy again.
 */
export async function listMyCourses(request: Request, response: Response) {
  const profile = await prisma.profile.findUnique({
    where: { id: getProfile(request).id },
    select: {
      university: { select: { name: true } },
      faculty: { select: { name: true } },
      savedCourses: { orderBy: { createdAt: 'asc' }, select: { course: { select: { id: true, code: true, title: true } } } },
    },
  })
  if (!profile) { response.status(404).json({ message: 'Profile not found.' }); return }
  response.json({
    school: profile.university && profile.faculty ? { universityName: profile.university.name, facultyName: profile.faculty.name } : null,
    courses: profile.savedCourses.map((entry) => entry.course),
  })
}

/**
 * POST /api/profile/courses — add a course with just a code and title. The
 * course is filed under a stable "General" department of the student's saved
 * faculty (same convention as typed uploads), a course that already exists for
 * that code is linked instead of duplicated, and the per-student cap holds.
 */
export async function addMyCourse(request: Request, response: Response) {
  const profileId = getProfile(request).id
  const code = cleanInput(request.body?.code).toUpperCase()
  const title = cleanInput(request.body?.title)
  if (!code || !title) {
    response.status(400).json({ message: 'Course code and title are required.' })
    return
  }

  try {
    const course = await prisma.$transaction(
      async (transaction) => {
        const profile = await transaction.profile.findUnique({ where: { id: profileId }, select: { facultyId: true } })
        if (!profile?.facultyId) throw new Error('SCHOOL_MISSING')
        const department = await transaction.department.upsert({
          where: { facultyId_slug: { facultyId: profile.facultyId, slug: 'general' } },
          update: {},
          create: { facultyId: profile.facultyId, name: 'General', slug: 'general' },
        })
        const saved = await transaction.course.upsert({
          where: { departmentId_code: { departmentId: department.id, code } },
          update: { title },
          create: { departmentId: department.id, code, title },
        })
        const link = await transaction.profileCourse.findUnique({ where: { profileId_courseId: { profileId, courseId: saved.id } } })
        if (!link) {
          const count = await transaction.profileCourse.count({ where: { profileId } })
          if (count >= MAX_SAVED_COURSES) throw new Error('COURSE_LIMIT')
          await transaction.profileCourse.create({ data: { profileId, courseId: saved.id } })
        }
        return saved
      },
      { maxWait: 10000, timeout: 15000 },
    )
    await recordProfileAudit(request, 'PROFILE_COURSE_ADDED', 'Course', course.id, { code })
    response.status(201).json({ course: { id: course.id, code: course.code, title: course.title } })
  } catch (error) {
    if (isControlFlow(error, 'SCHOOL_MISSING')) { response.status(400).json({ message: 'Add your university and faculty in your profile first.' }); return }
    if (isControlFlow(error, 'COURSE_LIMIT')) { response.status(409).json({ message: `You can save up to ${MAX_SAVED_COURSES} courses. Remove one first.` }); return }
    response.status(500).json({ message: 'Could not save the course.' })
  }
}

/**
 * DELETE /api/profile/courses/:courseId — unlink the course from the student
 * only. The Course entity stays because papers and generated sets reference it.
 */
export async function removeMyCourse(request: Request, response: Response) {
  const courseId = Array.isArray(request.params.courseId) ? request.params.courseId[0] : request.params.courseId
  try {
    await prisma.profileCourse.delete({ where: { profileId_courseId: { profileId: getProfile(request).id, courseId } } })
    await recordProfileAudit(request, 'PROFILE_COURSE_REMOVED', 'Course', courseId)
    response.status(204).send()
  } catch {
    response.status(404).json({ message: 'That course is not in your saved list.' })
  }
}

/**
 * GET /api/profile/referral — the student's invite code + how many friends
 * have joined with it. The code itself is generated on signup.
 */
export async function getReferralInfo(request: Request, response: Response) {
  const me = getProfile(request).id
  const profile = await prisma.profile.findUnique({
    where: { id: me },
    select: { referralCode: true, tier: true, xp: true },
  })
  if (!profile) { response.status(404).json({ message: 'Profile not found.' }); return }
  const invites = await prisma.profile.count({ where: { referredById: me } })
  response.json({ referral: { referralCode: profile.referralCode, tier: profile.tier, xp: profile.xp, invites } })
}

/**
 * GET /api/profile/missions — every mission the student can see plus which ones
 * they have already claimed and their current XP. Active missions are claimable;
 * inactive ones stay visible (they were claimed) but are not offered.
 */
export async function listMissions(request: Request, response: Response) {
  const me = getProfile(request).id
  const [profile, missions, claims] = await Promise.all([
    prisma.profile.findUnique({ where: { id: me }, select: { xp: true, tier: true } }),
    prisma.mission.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] }),
    prisma.userClaimedMission.findMany({ where: { profileId: me }, select: { missionId: true, claimedAt: true } }),
  ])
  const claimed = new Map(claims.map((claim) => [claim.missionId, claim.claimedAt]))
  response.json({
    xp: profile?.xp ?? 0,
    tier: profile?.tier ?? 'FREE',
    missions: missions.map((mission) => ({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      xpReward: mission.xpReward,
      isActive: mission.isActive,
      claimedAt: claimed.get(mission.id) ?? null,
    })),
  })
}

/**
 * POST /api/profile/missions/:missionId/claim — claim an active mission once.
 * XP is added to the profile and the miss/claimed link is recorded.
 */
export async function claimMission(request: Request, response: Response) {
  const me = getProfile(request).id
  const missionId = Array.isArray(request.params.missionId) ? request.params.missionId[0] : request.params.missionId
  try {
    const mission = await prisma.mission.findUnique({ where: { id: missionId } })
    if (!mission || !mission.isActive) { response.status(404).json({ message: 'That mission is not available right now.' }); return }
    const existing = await prisma.userClaimedMission.findUnique({ where: { profileId_missionId: { profileId: me, missionId } } })
    if (existing) { response.status(409).json({ message: 'You already claimed this mission.' }); return }
    await prisma.userClaimedMission.create({ data: { profileId: me, missionId } })
    const profile = await prisma.profile.update({ where: { id: me }, data: { xp: { increment: mission.xpReward } }, select: { xp: true } })
    await prisma.auditEvent.create({ data: { actorId: me, action: 'MISSION_CLAIMED', entityType: 'Mission', entityId: missionId, metadata: { xpEarned: mission.xpReward } } })
    response.status(201).json({ xp: profile.xp, xpEarned: mission.xpReward, missionId })
  } catch { response.status(500).json({ message: 'Could not claim that mission.' }) }
}

/**
 * DELETE /api/profile — permanent account deletion. The student must confirm by
 * sending `confirmText: "delete"`. Before the row is removed an audit event is
 * written that keeps their full name, email and username — those are dropped
 * from the Profile row itself, so the log is the only permanent record.
 */
export async function deleteAccount(request: Request, response: Response) {
  const profile = (request as AuthenticatedRequest).profile
  const confirmText = typeof request.body?.confirmText === 'string' ? request.body.confirmText.trim().toLowerCase() : ''
  if (confirmText !== 'delete') { response.status(400).json({ message: 'Type “delete” to confirm you want to permanently remove your account.' }); return }

  // Snapshot for the audit trail before anything is removed.
  const auditDetails = { deletedEmail: profile.email, deletedName: profile.displayName, deletedUsername: profile.username, deletedTier: profile.tier, referralCode: profile.referralCode, reason: 'User requested account deletion' }
  await prisma.auditEvent.create({ data: { actorId: profile.id, action: 'USER_DELETED', entityType: 'Profile', entityId: profile.id, metadata: auditDetails } })

  // Papers are not merged into the profile delete (owner is required), so the
  // owned rows (and their stored files when storage is configured) are removed.
  try {
    const owned = await prisma.paper.findMany({ where: { ownerId: profile.id }, select: { id: true, fileUrl: true } })
    for (const paper of owned) {
      if (paper.fileUrl) {
        try { await supabase.storage.from(env.supabaseBucket).remove([paper.fileUrl]) } catch { /* file cleanup is best-effort */ }
      }
    }
    await prisma.paper.deleteMany({ where: { ownerId: profile.id } })
    await prisma.generatedSet.deleteMany({ where: { userId: profile.id } })
    await prisma.profile.delete({ where: { id: profile.id } })
  } catch {
    response.status(500).json({ message: 'Could not delete your account right now. Please try again later.' })
    return
  }
  response.clearCookie('recappedu_session')
  response.status(204).send()
}

/**
 * GET /api/profile/xp — a tiny helper used by the profile header so the UI can
 * show current XP without pulling the full missions list.
 */
/**
 * POST /api/profile/redeem — a student redeems a promo code they were given.
 * Active codes with uses left grant premium days (stacked on top of the later
 * of now / their current premium window) and/or bonus XP — once per student.
 */
export async function redeemPromoCode(request: Request, response: Response) {
  const me = getProfile(request).id
  const code = cleanInput(request.body?.code).toUpperCase().replace(/[^A-Z0-9_-]/g, '')
  if (!code) { response.status(400).json({ message: 'Enter the code you were given.' }); return }

  const promo = await prisma.promoCode.findUnique({ where: { code }, include: { _count: { select: { redemptions: true } } } })
  if (!promo || !promo.isActive) { response.status(404).json({ message: 'That code is not valid.' }); return }
  if (promo.expiresAt && promo.expiresAt <= new Date()) { response.status(410).json({ message: 'That code has expired.' }); return }
  if (promo.maxRedemptions !== null && promo._count.redemptions >= promo.maxRedemptions) { response.status(410).json({ message: 'That code has run out of uses.' }); return }
  const already = await prisma.codeRedemption.findUnique({ where: { codeId_profileId: { codeId: promo.id, profileId: me } } })
  if (already) { response.status(409).json({ message: 'You have already redeemed this code.' }); return }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const current = await transaction.profile.findUnique({ where: { id: me }, select: { premiumUntil: true, xp: true } })
        if (!current) throw new Error('PROFILE_MISSING')
        const base = current.premiumUntil && current.premiumUntil > new Date() ? current.premiumUntil : new Date()
        const premiumUntil = promo.premiumDays > 0 ? new Date(base.getTime() + promo.premiumDays * 86400000) : current.premiumUntil
        const updated = await transaction.profile.update({
          where: { id: me },
          data: { premiumUntil, xp: promo.xpBonus > 0 ? { increment: promo.xpBonus } : undefined },
          select: { premiumUntil: true, xp: true },
        })
        await transaction.codeRedemption.create({ data: { codeId: promo.id, profileId: me } })
        return { premiumUntil: updated.premiumUntil, xp: updated.xp }
      },
      { maxWait: 10000, timeout: 15000 },
    )
    await prisma.auditEvent.create({ data: { actorId: me, action: 'PROMO_CODE_REDEEMED', entityType: 'PromoCode', entityId: promo.id, metadata: { code: promo.code, premiumDays: promo.premiumDays, xpBonus: promo.xpBonus } } })
    response.json({ redeemed: true, code: promo.code, premiumDays: promo.premiumDays, xpBonus: promo.xpBonus, premiumUntil: result.premiumUntil, xp: result.xp })
  } catch {
    response.status(500).json({ message: 'Could not redeem that code right now.' })
  }
}

export async function getXp(request: Request, response: Response) {
  const me = await prisma.profile.findUnique({ where: { id: getProfile(request).id }, select: { xp: true, tier: true, premiumUntil: true } })
  response.json({ xp: me?.xp ?? 0, tier: me?.tier ?? 'FREE', premiumUntil: me?.premiumUntil ?? null })
}