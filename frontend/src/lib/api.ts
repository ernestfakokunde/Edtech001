const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

// The backend protects every non-GET request with double-submit CSRF validation
// (see backend/src/middleware/csrf.ts). GET /api/auth/csrf issues the token and
// plants the matching recappedu_csrf cookie; we cache the token and attach it to
// state-changing requests as the x-csrf-token header.
const CSRF_HEADER = 'x-csrf-token'
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let csrfToken: string | null = null
let csrfFetch: Promise<string> | null = null

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  if (!csrfFetch) {
    csrfFetch = fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not establish a secure session. Refresh the page and try again.')
        const body = await response.json() as { csrfToken?: string }
        if (!body.csrfToken) throw new Error('The server did not return a verification token. Refresh the page and try again.')
        csrfToken = body.csrfToken
        return csrfToken
      })
      .finally(() => { csrfFetch = null })
  }
  return csrfFetch
}

export type AuthResponse = {
  profile: { id: string; email: string | null; displayName: string | null; username: string | null; isAdmin: boolean }
}

export type University = { id: string; name: string; slug: string }
export type Faculty = { id: string; name: string; slug: string; universityId: string }
export type Department = { id: string; name: string; slug: string; facultyId: string }
export type ApiCourse = { id: string; code: string; title: string; departmentId: string; crossListingCode: string | null }
export type AdminUser = { id: string; email: string; displayName: string | null; username: string | null; isAdmin: boolean; suspendedUntil: string | null; suspensionReason: string | null; createdAt: string; _count: { generatedSets: number; papers: number } }
export type RepositorySubmission = { id: string; description: string; level: string; session: string; year: number; semester: "FIRST" | "SECOND"; status: string; course: { code: string; title: string }; owner: { displayName: string | null; email: string } }
export type RepositoryPaper = { id: string; description: string; level: string; session: string; year: number; semester: "FIRST" | "SECOND"; status: string; course: { id: string; code: string; title: string }; owner: { displayName: string | null; username: string | null } }
export type UploadedPaper = { id: string; description: string; level: string; session: string; year: number; semester: "FIRST" | "SECOND"; status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"; visibility: "PRIVATE" | "PUBLIC" }
export type OwnedPaper = UploadedPaper & { course: { id: string; code: string; title: string } }
export type Pagination = { page: number; pageSize: number; total: number; pages: number }

async function request<T>(path: string, options: RequestInit, retried = false): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (!CSRF_SAFE_METHODS.has(method)) headers[CSRF_HEADER] = await getCsrfToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })
  const body = response.status === 204 ? {} as T & { message?: string } : await response.json() as T & { message?: string }
  if (!response.ok) {
    // A stale or missing CSRF token is the usual cause of a 403 on a state-changing
    // request. Refetch the token once and replay the request before surfacing the error.
    if (!retried && response.status === 403 && !CSRF_SAFE_METHODS.has(method)) {
      csrfToken = null
      return request<T>(path, options, true)
    }
    throw new Error(body.message ?? 'The request could not be completed.')
  }
  return body
}

export function signup(input: { email: string; password: string; displayName: string }) {
  return request<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) })
}

export function login(input: { email: string; password: string }) {
  return request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function getCurrentProfile() {
  return request<AuthResponse>('/api/auth/me', { method: 'GET' })
}

export function updateProfile(input: { displayName: string; username: string }) {
  return request<AuthResponse>('/api/profile', { method: 'PATCH', body: JSON.stringify(input) })
}

export function getUniversities() { return request<{ universities: University[] }>('/api/hierarchy/universities', { method: 'GET' }) }
export function getFaculties(universityId: string) { return request<{ faculties: Faculty[] }>(`/api/hierarchy/universities/${universityId}/faculties`, { method: 'GET' }) }
export function getDepartments(facultyId: string) { return request<{ departments: Department[] }>(`/api/hierarchy/faculties/${facultyId}/departments`, { method: 'GET' }) }
export function getCourses(departmentId: string) { return request<{ courses: ApiCourse[] }>(`/api/hierarchy/departments/${departmentId}/courses`, { method: 'GET' }) }
export function createUniversity(name: string) { return request<{ university: University }>('/api/hierarchy/universities', { method: 'POST', body: JSON.stringify({ name }) }) }
export function createFaculty(universityId: string, name: string) { return request<{ faculty: Faculty }>(`/api/hierarchy/universities/${universityId}/faculties`, { method: 'POST', body: JSON.stringify({ name }) }) }
export function createDepartment(facultyId: string, name: string) { return request<{ department: Department }>(`/api/hierarchy/faculties/${facultyId}/departments`, { method: 'POST', body: JSON.stringify({ name }) }) }
export function createCourse(departmentId: string, input: { code: string; title: string; crossListingCode?: string }) { return request<{ course: ApiCourse }>(`/api/hierarchy/departments/${departmentId}/courses`, { method: 'POST', body: JSON.stringify(input) }) }
export function updateUniversity(id: string, name: string) { return request<{ university: University }>(`/api/hierarchy/universities/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }) }
export function updateFaculty(id: string, name: string) { return request<{ faculty: Faculty }>(`/api/hierarchy/faculties/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }) }
export function updateDepartment(id: string, name: string) { return request<{ department: Department }>(`/api/hierarchy/departments/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }) }
export function deleteUniversity(id: string) { return request<void>(`/api/hierarchy/universities/${id}`, { method: 'DELETE' }) }
export function deleteFaculty(id: string) { return request<void>(`/api/hierarchy/faculties/${id}`, { method: 'DELETE' }) }
export function deleteDepartment(id: string) { return request<void>(`/api/hierarchy/departments/${id}`, { method: 'DELETE' }) }
export function updateCourse(id: string, input: { code: string; title: string; crossListingCode?: string }) { return request<{ course: ApiCourse }>(`/api/hierarchy/courses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function deleteCourse(id: string) { return request<void>(`/api/hierarchy/courses/${id}`, { method: 'DELETE' }) }

export function getAdminUsers(filters: { search?: string; universityId?: string; departmentId?: string }) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value))
  return request<{ users: AdminUser[] }>(`/api/admin/users?${params.toString()}`, { method: 'GET' })
}
export function suspendAdminUser(userId: string, input: { until: string; reason: string }) { return request<{ user: Pick<AdminUser, 'id' | 'suspendedUntil' | 'suspensionReason'> }>(`/api/admin/users/${userId}/suspend`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function unsuspendAdminUser(userId: string) { return request<{ user: Pick<AdminUser, 'id' | 'suspendedUntil' | 'suspensionReason'> }>(`/api/admin/users/${userId}/unsuspend`, { method: 'PATCH', body: JSON.stringify({}) }) }
export function getAdminActivity() { return request<{ activity: { id: string; action: string; entityType: string; createdAt: string; actor: { displayName: string | null; username: string | null } | null }[] }>('/api/admin/activity', { method: 'GET' }) }
export function getAdminSubmissions() { return request<{ submissions: RepositorySubmission[] }>('/api/admin/repository-submissions', { method: 'GET' }) }
export function getRepositoryPapers(filters: { search?: string; level?: string; courseId?: string; universityId?: string; facultyId?: string; departmentId?: string; page?: number; pageSize?: number }) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value))); return request<{ papers: RepositoryPaper[]; pagination: Pagination }>(`/api/papers/repository?${params.toString()}`, { method: 'GET' }) }
export function getRepositoryPaper(paperId: string) { return request<{ paper: RepositoryPaper }>(`/api/papers/repository/${encodeURIComponent(paperId)}`, { method: 'GET' }) }
export function reviewSubmission(paperId: string, input: { decision: "APPROVED" | "REJECTED"; note?: string }) { return request<{ paper: RepositoryPaper }>(`/api/admin/repository-submissions/${paperId}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function getMyPapers(page = 1) { return request<{ papers: OwnedPaper[]; pagination: Pagination }>(`/api/papers/mine?page=${page}&pageSize=20`, { method: 'GET' }) }
export function updateMyPaper(paperId: string, input: Pick<OwnedPaper, 'description' | 'level' | 'session' | 'year' | 'semester'>) { return request<{ paper: OwnedPaper }>(`/api/papers/${encodeURIComponent(paperId)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function deleteMyPaper(paperId: string) { return request<void>(`/api/papers/${encodeURIComponent(paperId)}`, { method: 'DELETE' }) }

export async function uploadPaper(input: { file: File; courseId?: string; universityName?: string; facultyName?: string; courseTitle?: string; courseCode?: string; description: string; level: string; session: string; year: string; semester: "FIRST" | "SECOND" }) {
  const formData = new FormData()
  Object.entries(input).forEach(([key, value]) => formData.append(key, value instanceof File ? value : value))
  let response = await fetch(`${API_URL}/api/papers`, { method: 'POST', credentials: 'include', body: formData, headers: { [CSRF_HEADER]: await getCsrfToken() } })
  if (response.status === 403) {
    csrfToken = null
    response = await fetch(`${API_URL}/api/papers`, { method: 'POST', credentials: 'include', body: formData, headers: { [CSRF_HEADER]: await getCsrfToken() } })
  }
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? await response.json() as { paper?: UploadedPaper; message?: string }
    : { message: response.ok ? 'The server returned an unexpected response.' : `Upload failed with status ${response.status}. Check that the backend is running.` }
  if (!response.ok) throw new Error(body.message ?? 'The paper could not be uploaded.')
  return body as { paper: UploadedPaper }
}

export function submitPaper(paperId: string) { return request<{ paper: OwnedPaper }>(`/api/papers/${paperId}/submit`, { method: 'PATCH', body: JSON.stringify({}) }) }
export function getPaperDownloadUrl(paperId: string) { return request<{ url: string }>(`/api/papers/${paperId}/download`, { method: 'GET' }) }

export async function logout() {
  let response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { [CSRF_HEADER]: await getCsrfToken() },
  })
  if (response.status === 403) {
    csrfToken = null
    response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: await getCsrfToken() },
    })
  }
  if (!response.ok) throw new Error('Could not sign out.')
}
