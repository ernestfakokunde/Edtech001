import { prisma } from '../lib/prisma.js'

/**
 * Course resolution shared by table uploads (paper.controller) and private AI
 * generation (generatedSet.controller).
 *
 * A request may either reference an existing course by id OR type the course
 * details directly. In the typed case the university → faculty → department
 * → course chain is upserted in one transaction (mirroring the repository
 * upload form), so a student can generate a private study set without having
 * uploaded a paper first.
 */

export type CourseInput = {
  courseId?: string | null
  universityName?: string | null
  facultyName?: string | null
  courseCode?: string | null
  courseTitle?: string | null
}

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export type ResolvedCourse = NonNullable<Awaited<ReturnType<typeof resolveCourseBody>>>

async function resolveCourseBody(where: { id: string }) {
  return prisma.course.findUnique({
    where,
    include: { department: { include: { faculty: { include: { university: true } } } } },
  })
}

/**
 * Returns the course for the input (with its hierarchy), or null when an
 * explicit courseId is given but not found, or when the typed course details
 * are incomplete.
 */
export async function resolveCourse(input: CourseInput) {
  if (input.courseId) {
    return resolveCourseBody({ id: input.courseId })
  }

  const universityName = input.universityName?.trim()
  const facultyName = input.facultyName?.trim()
  const courseCode = input.courseCode?.trim()
  const courseTitle = input.courseTitle?.trim()
  if (!universityName || !facultyName || !courseCode || !courseTitle) return null

  return prisma.$transaction(
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
      const department = await transaction.department.upsert({
        where: { facultyId_slug: { facultyId: faculty.id, slug: 'general' } },
        update: {},
        create: { facultyId: faculty.id, name: 'General', slug: 'general' },
      })
      const code = courseCode.toUpperCase()
      return transaction.course.upsert({
        where: { departmentId_code: { departmentId: department.id, code } },
        update: { title: courseTitle },
        create: { departmentId: department.id, code, title: courseTitle },
        include: { department: { include: { faculty: { include: { university: true } } } } },
      })
    },
    { maxWait: 10000, timeout: 15000 },
  )
}