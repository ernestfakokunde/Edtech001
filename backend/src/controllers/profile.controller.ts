import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
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