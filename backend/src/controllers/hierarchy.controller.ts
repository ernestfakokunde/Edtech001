import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function routeParam(request: Request, name: string) {
  const value = request.params[name]
  return Array.isArray(value) ? value[0] : value
}

export async function listUniversities(_request: Request, response: Response) {
  response.json({ universities: await prisma.university.findMany({ orderBy: { name: 'asc' } }) })
}

export async function listFaculties(request: Request, response: Response) {
  response.json({ faculties: await prisma.faculty.findMany({ where: { universityId: routeParam(request, 'universityId') }, orderBy: { name: 'asc' } }) })
}

export async function listDepartments(request: Request, response: Response) {
  response.json({ departments: await prisma.department.findMany({ where: { facultyId: routeParam(request, 'facultyId') }, orderBy: { name: 'asc' } }) })
}

export async function listCourses(request: Request, response: Response) {
  response.json({ courses: await prisma.course.findMany({ where: { departmentId: routeParam(request, 'departmentId') }, orderBy: { code: 'asc' } }) })
}

export async function createUniversity(request: Request, response: Response) {
  const { name } = request.body as { name?: string }
  const cleanName = typeof name === 'string' ? name.trim() : ''
  if (!cleanName) { response.status(400).json({ message: 'University name is required.' }); return }
  try {
    const university = await prisma.university.create({ data: { name: cleanName, slug: slugify(cleanName) } })
    await recordHierarchyAudit(request, 'HIERARCHY_UNIVERSITY_CREATED', 'University', university.id, { name: university.name })
    response.status(201).json({ university })
  } catch { response.status(409).json({ message: 'That university already exists.' }) }
}

export async function createFaculty(request: Request, response: Response) {
  const { name } = request.body as { name?: string }
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const universityId = routeParam(request, 'universityId')
  if (!cleanName) { response.status(400).json({ message: 'Faculty name is required.' }); return }
  try {
    const faculty = await prisma.faculty.create({ data: { name: cleanName, slug: slugify(cleanName), universityId } })
    await recordHierarchyAudit(request, 'HIERARCHY_FACULTY_CREATED', 'Faculty', faculty.id, { name: faculty.name, universityId })
    response.status(201).json({ faculty })
  } catch { response.status(409).json({ message: 'That faculty already exists in this university.' }) }
}

export async function createDepartment(request: Request, response: Response) {
  const { name } = request.body as { name?: string }
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const facultyId = routeParam(request, 'facultyId')
  if (!cleanName) { response.status(400).json({ message: 'Department name is required.' }); return }
  try {
    const department = await prisma.department.create({ data: { name: cleanName, slug: slugify(cleanName), facultyId } })
    await recordHierarchyAudit(request, 'HIERARCHY_DEPARTMENT_CREATED', 'Department', department.id, { name: department.name, facultyId })
    response.status(201).json({ department })
  } catch { response.status(409).json({ message: 'That department already exists in this faculty.' }) }
}

export async function createCourse(request: Request, response: Response) {
  const { code, title, crossListingCode } = request.body as { code?: string; title?: string; crossListingCode?: string }
  const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : ''
  const cleanTitle = typeof title === 'string' ? title.trim() : ''
  const departmentId = routeParam(request, 'departmentId')
  if (!cleanCode || !cleanTitle) { response.status(400).json({ message: 'Course code and title are required.' }); return }
  try {
    const course = await prisma.course.create({ data: { code: cleanCode, title: cleanTitle, crossListingCode: crossListingCode?.trim() || null, departmentId } })
    await recordHierarchyAudit(request, 'HIERARCHY_COURSE_CREATED', 'Course', course.id, { code: course.code, departmentId })
    response.status(201).json({ course })
  } catch { response.status(409).json({ message: 'That course already exists in this department.' }) }
}

export async function updateUniversity(request: Request, response: Response) {
  const id = routeParam(request, 'universityId')
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  if (!name) { response.status(400).json({ message: 'University name is required.' }); return }
  try { const university = await prisma.university.update({ where: { id }, data: { name, slug: slugify(name) } }); await recordHierarchyAudit(request, 'HIERARCHY_UNIVERSITY_UPDATED', 'University', id, { name }); response.json({ university }) } catch { response.status(404).json({ message: 'University not found or its slug is already used.' }) }
}

export async function updateFaculty(request: Request, response: Response) {
  const id = routeParam(request, 'facultyId')
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  if (!name) { response.status(400).json({ message: 'Faculty name is required.' }); return }
  try { const faculty = await prisma.faculty.update({ where: { id }, data: { name, slug: slugify(name) } }); await recordHierarchyAudit(request, 'HIERARCHY_FACULTY_UPDATED', 'Faculty', id, { name }); response.json({ faculty }) } catch { response.status(404).json({ message: 'Faculty not found or its slug is already used.' }) }
}

export async function updateDepartment(request: Request, response: Response) {
  const id = routeParam(request, 'departmentId')
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  if (!name) { response.status(400).json({ message: 'Department name is required.' }); return }
  try { const department = await prisma.department.update({ where: { id }, data: { name, slug: slugify(name) } }); await recordHierarchyAudit(request, 'HIERARCHY_DEPARTMENT_UPDATED', 'Department', id, { name }); response.json({ department }) } catch { response.status(404).json({ message: 'Department not found or its slug is already used.' }) }
}

export async function updateCourse(request: Request, response: Response) {
  const id = routeParam(request, 'courseId')
  const code = typeof request.body?.code === 'string' ? request.body.code.trim().toUpperCase() : ''
  const title = typeof request.body?.title === 'string' ? request.body.title.trim() : ''
  if (!code || !title) { response.status(400).json({ message: 'Course code and title are required.' }); return }
  try { const course = await prisma.course.update({ where: { id }, data: { code, title, crossListingCode: typeof request.body?.crossListingCode === 'string' ? request.body.crossListingCode.trim() || null : null } }); await recordHierarchyAudit(request, 'HIERARCHY_COURSE_UPDATED', 'Course', id, { code }); response.json({ course }) } catch { response.status(404).json({ message: 'Course not found or its code is already used.' }) }
}

export async function deleteUniversity(request: Request, response: Response) {
  const id = routeParam(request, 'universityId')
  const university = await prisma.university.findUnique({ where: { id }, select: { faculties: { select: { _count: { select: { departments: true } } } } } })
  if (!university) { response.status(404).json({ message: 'University not found.' }); return }
  if (university.faculties.length > 0) { response.status(409).json({ message: 'Delete all faculties before deleting this university.' }); return }
  await prisma.university.delete({ where: { id } }); await recordHierarchyAudit(request, 'HIERARCHY_UNIVERSITY_DELETED', 'University', id); response.status(204).send()
}

export async function deleteFaculty(request: Request, response: Response) {
  const id = routeParam(request, 'facultyId')
  const faculty = await prisma.faculty.findUnique({ where: { id }, select: { departments: { select: { _count: { select: { courses: true } } } } } })
  if (!faculty) { response.status(404).json({ message: 'Faculty not found.' }); return }
  if (faculty.departments.length > 0) { response.status(409).json({ message: 'Delete all departments before deleting this faculty.' }); return }
  await prisma.faculty.delete({ where: { id } }); await recordHierarchyAudit(request, 'HIERARCHY_FACULTY_DELETED', 'Faculty', id); response.status(204).send()
}

export async function deleteDepartment(request: Request, response: Response) {
  const id = routeParam(request, 'departmentId')
  const department = await prisma.department.findUnique({ where: { id }, select: { _count: { select: { courses: true } } } })
  if (!department) { response.status(404).json({ message: 'Department not found.' }); return }
  if (department._count.courses > 0) { response.status(409).json({ message: 'Delete all courses before deleting this department.' }); return }
  await prisma.department.delete({ where: { id } }); await recordHierarchyAudit(request, 'HIERARCHY_DEPARTMENT_DELETED', 'Department', id); response.status(204).send()
}

export async function deleteCourse(request: Request, response: Response) {
  const id = routeParam(request, 'courseId')
  const course = await prisma.course.findUnique({ where: { id }, select: { _count: { select: { papers: true, generatedSets: true } } } })
  if (!course) { response.status(404).json({ message: 'Course not found.' }); return }
  if (course._count.papers > 0 || course._count.generatedSets > 0) { response.status(409).json({ message: 'This course cannot be deleted while it has papers or generated sets.' }); return }
  await prisma.course.delete({ where: { id } }); await recordHierarchyAudit(request, 'HIERARCHY_COURSE_DELETED', 'Course', id); response.status(204).send()
}

function actorId(request: Request) {
  return (request as AuthenticatedRequest).profile.id
}

function recordHierarchyAudit(request: Request, action: string, entityType: string, entityId: string, metadata?: object) {
  return prisma.auditEvent.create({ data: { actorId: actorId(request), action, entityType, entityId, metadata } })
}