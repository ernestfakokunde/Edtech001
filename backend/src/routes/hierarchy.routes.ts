import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { createCourse, createDepartment, createFaculty, createUniversity, deleteCourse, deleteDepartment, deleteFaculty, deleteUniversity, listCourses, listDepartments, listFaculties, listUniversities, updateCourse, updateDepartment, updateFaculty, updateUniversity } from '../controllers/hierarchy.controller.js'

export const hierarchyRouter = Router()
hierarchyRouter.use(requireAuth)
hierarchyRouter.route('/universities').get(listUniversities).post(createUniversity)
hierarchyRouter.route('/universities/:universityId').patch(updateUniversity).delete(deleteUniversity)
hierarchyRouter.route('/universities/:universityId/faculties').get(listFaculties).post(createFaculty)
hierarchyRouter.route('/faculties/:facultyId').patch(updateFaculty).delete(deleteFaculty)
hierarchyRouter.route('/faculties/:facultyId/departments').get(listDepartments).post(createDepartment)
hierarchyRouter.route('/departments/:departmentId').patch(updateDepartment).delete(deleteDepartment)
hierarchyRouter.route('/departments/:departmentId/courses').get(listCourses).post(createCourse)
hierarchyRouter.route('/courses/:courseId').patch(updateCourse).delete(deleteCourse)