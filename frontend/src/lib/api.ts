/**
 * In development the app talks to Vite, and Vite proxies `/api` to the Express
 * server (see vite.config.ts). A same-origin call skips the CORS preflight that
 * used to cost an extra round trip per login/state change. A built deployment
 * still needs VITE_API_URL — `frontend/.env.production` pins it to the deployed
 * service — and falls back to the local API when it is missing.
 */
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:4000')

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
        let body: { csrfToken?: string }
        try { body = await response.json() as { csrfToken?: string } }
        catch { throw new Error('Could not establish a secure session. Refresh the page and try again.') }
        if (!body.csrfToken) throw new Error('The server did not return a verification token. Refresh the page and try again.')
        csrfToken = body.csrfToken
        return csrfToken
      })
      .catch((reason: unknown) => {
        // Never surface `TypeError: Failed to fetch` from a warm-up call.
        throw new Error(isTransportError(reason) ? OFFLINE_MESSAGE : reason instanceof Error ? reason.message : 'Could not establish a secure session. Refresh the page and try again.')
      })
      .finally(() => { csrfFetch = null })
  }
  return csrfFetch
}

/**
 * Warms the CSRF token + cookie in the background so the first state-changing
 * request (usually login) does not have to wait for a second round trip.
 */
export function prefetchCsrfToken(): void {
  void getCsrfToken().catch(() => { /* the next real request reports the failure */ })
}

export type AuthResponse = {
  profile: { id: string; email: string | null; displayName: string | null; username: string | null; isAdmin: boolean; tier?: "FREE" | "PREMIUM"; xp?: number; referralCode?: string | null; premiumUntil?: string | null }
}
export type AuthProfile = AuthResponse["profile"]

export type University = { id: string; name: string; slug: string }
export type Faculty = { id: string; name: string; slug: string; universityId: string }
export type Department = { id: string; name: string; slug: string; facultyId: string }
export type ApiCourse = { id: string; code: string; title: string; departmentId: string; crossListingCode: string | null }
// The school a student saved on their profile (null until they do) and the
// course entries kept on it for quick personal uploads and generation.
export type SavedCourse = { id: string; code: string; title: string }
export type MySchool = { universityName: string; facultyName: string } | null
export type MyCoursesResponse = { school: MySchool; courses: SavedCourse[] }
export type AdminUser = { id: string; email: string; displayName: string | null; username: string | null; isAdmin: boolean; tier: "FREE" | "PREMIUM"; xp: number; referralCode: string | null; suspendedUntil: string | null; suspensionReason: string | null; createdAt: string; _count: { generatedSets: number; papers: number } }
export type RepositorySubmission = { id: string; description: string; level: string; session: string; year: number; semester: "FIRST" | "SECOND"; status: string; course: { code: string; title: string }; owner: { displayName: string | null; email: string } }
export type RepositoryPaper = { id: string; description: string; level: string; session: string; year: number; semester: "FIRST" | "SECOND"; status: string; course: { id: string; code: string; title: string }; owner: { displayName: string | null; username: string | null } }
export type UploadedPaper = { id: string; description: string; level: string; session: string; year: number; semester: "FIRST" | "SECOND"; status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"; visibility: "PRIVATE" | "PUBLIC" }
export type OwnedPaper = UploadedPaper & { course: { id: string; code: string; title: string } }
export type Pagination = { page: number; pageSize: number; total: number; pages: number }

// Generated study sets (flashcards / quizzes). metadata mirrors Question.metadata:
// the AI provider/model/promptVersion that produced the item, plus the multiple
// choice options for QUIZ items.
export type GeneratedQuestionMetadata = { provider?: string; model?: string; promptVersion?: string; options?: string[] }
export type GeneratedQuestion = { id: string; paperId: string; questionNo: string | null; prompt: string; answer: string | null; explanation: string | null; metadata: GeneratedQuestionMetadata | null; createdAt: string }
export type GeneratedSetItem = { position: number; question: GeneratedQuestion }
export type GeneratedSet = { id: string; userId: string; courseId: string; type: "FLASHCARD" | "QUIZ"; title: string; requestedLength: number; timePerQuestion: number | null; createdAt: string; items: GeneratedSetItem[] }

// AI providers usable for generation. `configured` mirrors the backend: an
// API key is set for it, so it can serve POST /api/generation right now.
export type GenerationProvider = { id: string; label: string; configured: boolean }

// One finished quiz run, as returned by GET /api/generation/attempts.
export type QuizAttempt = {
  id: string; userId: string; setId: string; score: number; total: number; percent: number; createdAt: string;
  set: { id: string; title: string; timePerQuestion: number | null; course: { code: string; title: string } };
}
export type QuizAttemptStats = { attempts: number; average: number; best: number }

// Missions: students claim active ones for XP (visible on their profile).
export type ProfileMission = { id: string; title: string; description: string | null; xpReward: number; isActive: boolean; claimedAt: string | null }
export type AdminMission = { id: string; title: string; description: string | null; xpReward: number; isActive: boolean; createdAt: string; claimCount: number }

// Daily quiz-generation quota. `limit: null` means unlimited (PREMIUM).
export type GenerationQuota = { tier: "FREE" | "PREMIUM"; limit: number | null; used: number; remaining: number | null; resetsAt: string }

export type ReferralInfo = { referralCode: string | null; tier: "FREE" | "PREMIUM"; xp: number; invites: number }

export type ActivityEntry = {
  id: string; action: string; entityType: string; createdAt: string;
  actor: { id: string; email: string; displayName: string | null; username: string | null } | null;
  metadata?: { deletedEmail?: string; deletedName?: string | null; deletedUsername?: string | null; title?: string; xpReward?: number } | null
}

/**
 * Every user-visible failure goes through this helper so the UI never prints a
 * raw `TypeError: Failed to fetch`, a JSON parser stack trace, a [object Object]
 * or an HTTP status line. Non-Error throws (string, object, null) are folded
 * into the caller's fallback text.
 */
export function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'string' && reason.trim()) return reason
  if (reason instanceof Error && typeof reason.message === 'string' && reason.message.trim() && !/^\[object/i.test(reason.message)) return reason.message
  return fallback
}

/** A network failure (server asleep/offline) reads nothing like an HTTP error. */
function isTransportError(reason: unknown) {
  return reason instanceof TypeError
    || (reason instanceof Error && /failed to fetch|network ?error|load failed|fetch failed|aborted/i.test(reason.message))
}

const OFFLINE_MESSAGE = 'We could not reach the server. Check your connection and try again.'

/**
 * Upload contract, mirrored from `backend/src/utils/upload.ts`. Checking here
 * matters most on a phone: a 14 MB photo-scan spends minutes uploading a body
 * the server stops reading at 10 MB, and the browser reports that aborted
 * transfer as an opaque transfer error instead of a size problem.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '10 MB'
const UPLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx']

/**
 * Returns the message to show for a file this app cannot upload, or null when
 * the file is fine. Called before the request so the answer never depends on
 * how far a mobile upload got before it failed.
 */
export function uploadFileProblem(file: File): string | null {
  const name = file.name.toLowerCase()
  if (!UPLOAD_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return 'That file type is not supported. Choose a PDF, DOC or DOCX file.'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const size = `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    return `That file is ${size}, over the ${MAX_UPLOAD_LABEL} limit. Compress it or upload a smaller version.`
  }
  return null
}

/**
 * `fetch` for the endpoints that cannot use the JSON helper (multipart bodies
 * and sign-out). A transport failure has to become an Error with readable text:
 * the browser's own message ("Failed to fetch" on Chrome, "Load failed" on
 * Safari) tells the user nothing about what to do next.
 */
async function fetchWithOfflineMessage(url: string, init: RequestInit, offlineHint?: string): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (reason) {
    if (isTransportError(reason)) throw new Error(offlineHint ? `${OFFLINE_MESSAGE} ${offlineHint}` : OFFLINE_MESSAGE)
    throw new Error('The request could not be completed.')
  }
}

/** The hint appended when an upload dies mid-flight on a weak mobile link. */
const UPLOAD_INTERRUPTED_HINT = 'The upload did not finish — on a weak connection try a smaller file.'

function apiError(response: Response, message?: string) {
  if (message) return new Error(message)
  if (response.status === 401) return new Error('Your session has expired. Please sign in again.')
  if (response.status === 403) return new Error('You do not have permission to do that.')
  if (response.status === 404) return new Error('We could not find what you asked for.')
  if (response.status === 429) return new Error('Too many attempts. Please wait a moment and try again.')
  if (response.status >= 500) return new Error('The server ran into a problem. Please try again shortly.')
  return new Error('The request could not be completed.')
}

async function request<T>(path: string, options: RequestInit, retried = false): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (!CSRF_SAFE_METHODS.has(method)) headers[CSRF_HEADER] = await getCsrfToken()
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    })
  } catch (reason) {
    throw new Error(isTransportError(reason) ? OFFLINE_MESSAGE : 'The request could not be completed.')
  }
  // A non-JSON body (crashing proxy, HTML error page) must never leak a parsing
  // error to the UI — it is reported by status instead.
  let body: T & { message?: string }
  if (response.status === 204) {
    body = {} as T & { message?: string }
  } else {
    try {
      body = await response.json() as T & { message?: string }
    } catch {
      body = {} as T & { message?: string }
    }
  }
  if (!response.ok) {
    // A stale or missing CSRF token is the usual cause of a 403 on a state-changing
    // request. Refetch the token once and replay the request before surfacing the error.
    if (!retried && response.status === 403 && !CSRF_SAFE_METHODS.has(method)) {
      csrfToken = null
      return request<T>(path, options, true)
    }
    throw apiError(response, typeof body.message === 'string' ? body.message : undefined)
  }
  return body
}

// Session profile cache: /api/auth/me is called on every app load. To avoid
// hammering the server each login/reload we keep the identity in localStorage
// for a short TTL and only revalidate when it's stale (or after sign in/out).
const PROFILE_CACHE_KEY = 'recappedu_profile_cache_v1'
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000

function readProfileCache(): AuthResponse | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { profile: AuthResponse['profile']; expiresAt: number }
    if (!cached?.profile || !cached.expiresAt || cached.expiresAt <= Date.now()) return null
    return { profile: cached.profile }
  } catch { return null }
}

function writeProfileCache(response: AuthResponse) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ profile: response.profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS })) } catch { /* non-fatal */ }
}

export function invalidateProfileCache() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(PROFILE_CACHE_KEY)
}

export async function signup(input: { email: string; password: string; displayName: string; referralCode?: string }) {
  const result = await request<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) })
  // Seed the identity cache straight from the auth response so the next screen
  // does not immediately re-request /api/auth/me (one less round trip per login).
  writeProfileCache(result)
  return result
}

export async function login(input: { email: string; password: string }) {
  const result = await request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) })
  writeProfileCache(result)
  return result
}

/** True when a non-expired identity is already cached — lets App skip its loading flash. */
export function hasProfileCache() { return readProfileCache() !== null }

export async function getCurrentProfile() {
  const cached = readProfileCache()
  if (cached) return cached
  const fresh = await request<AuthResponse>('/api/auth/me', { method: 'GET' })
  writeProfileCache(fresh)
  return fresh
}

export function updateProfile(input: { displayName: string; username: string }) {
  return request<AuthResponse>('/api/profile', { method: 'PATCH', body: JSON.stringify(input) })
}

// The student's school is entered once on the profile; both names are
// resolve-or-create on the backend, so re-submitting never duplicates rows.
export function saveMySchool(input: { universityName: string; facultyName: string }) {
  return request<{ school: { universityName: string; facultyName: string } }>('/api/profile/school', { method: 'PUT', body: JSON.stringify(input) })
}
export function getMyCourses() {
  return request<MyCoursesResponse>('/api/profile/courses', { method: 'GET' })
}
export function addMyCourse(input: { code: string; title: string }) {
  return request<{ course: SavedCourse }>('/api/profile/courses', { method: 'POST', body: JSON.stringify(input) })
}
export function removeMyCourse(courseId: string) {
  return request<void>(`/api/profile/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' })
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

export function getAdminUsers(filters: { search?: string; universityId?: string; departmentId?: string; role?: 'all' | 'admin'; recent?: 'all' | '24h' | '7d' | '30d' | '90d'; page?: number; pageSize?: number }) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value)))
  return request<{ users: AdminUser[]; pagination: Pagination }>(`/api/admin/users?${params.toString()}`, { method: 'GET' })
}
export function suspendAdminUser(userId: string, input: { until: string; reason: string }) { return request<{ user: Pick<AdminUser, 'id' | 'suspendedUntil' | 'suspensionReason'> }>(`/api/admin/users/${userId}/suspend`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function unsuspendAdminUser(userId: string) { return request<{ user: Pick<AdminUser, 'id' | 'suspendedUntil' | 'suspensionReason'> }>(`/api/admin/users/${userId}/unsuspend`, { method: 'PATCH', body: JSON.stringify({}) }) }
export function promoteAdminUser(email: string) { return request<{ user: Pick<AdminUser, 'id' | 'email' | 'displayName' | 'isAdmin'>; message?: string }>('/api/admin/users/promote', { method: 'POST', body: JSON.stringify({ email }) }) }
export function getAdminActivity(filters: { page?: number; type?: string; search?: string } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(filters.page ?? 1))
  params.set('pageSize', '15')
  if (filters.type && filters.type !== 'all') params.set('type', filters.type)
  if (filters.search) params.set('search', filters.search)
  return request<{ activity: ActivityEntry[]; pagination: Pagination }>(`/api/admin/activity?${params.toString()}`, { method: 'GET' })
}
export function getAdminSubmissions(filters: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; search?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value)))
  return request<{ submissions: RepositorySubmission[]; pagination: Pagination }>(`/api/admin/repository-submissions?${params.toString()}`, { method: 'GET' })
}
export function getModerationSummary() { return request<{ summary: { pending: number; approved: number; rejected: number; generatedSets: number; users: number } }>('/api/admin/moderation/summary', { method: 'GET' }) }
export function getRepositoryPapers(filters: { search?: string; level?: string; courseId?: string; universityId?: string; facultyId?: string; departmentId?: string; page?: number; pageSize?: number }) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value))); return request<{ papers: RepositoryPaper[]; pagination: Pagination }>(`/api/papers/repository?${params.toString()}`, { method: 'GET' }) }
export function getRepositoryPaper(paperId: string) { return request<{ paper: RepositoryPaper }>(`/api/papers/repository/${encodeURIComponent(paperId)}`, { method: 'GET' }) }
export function reviewSubmission(paperId: string, input: { decision: "APPROVED" | "REJECTED"; note?: string }) { return request<{ paper: RepositoryPaper }>(`/api/admin/repository-submissions/${paperId}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function getMyPapers(page = 1) { return request<{ papers: OwnedPaper[]; pagination: Pagination }>(`/api/papers/mine?page=${page}&pageSize=20`, { method: 'GET' }) }
export function updateMyPaper(paperId: string, input: Pick<OwnedPaper, 'description' | 'level' | 'session' | 'year' | 'semester'>) { return request<{ paper: OwnedPaper }>(`/api/papers/${encodeURIComponent(paperId)}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function deleteMyPaper(paperId: string) { return request<void>(`/api/papers/${encodeURIComponent(paperId)}`, { method: 'DELETE' }) }

export async function uploadPaper(input: { file: File; courseId?: string; universityName?: string; facultyName?: string; courseTitle?: string; courseCode?: string; description: string; level: string; session: string; year: string; semester: "FIRST" | "SECOND" }) {
  // Rejected before a single byte leaves the device: the API stops reading at
  // MAX_UPLOAD_BYTES, and an upload that dies there is the case phones report as
  // a bare "Failed to fetch" with no hint about the real problem.
  const problem = uploadFileProblem(input.file)
  if (problem) throw new Error(problem)
  const buildFormData = () => {
    const next = new FormData()
    Object.entries(input).forEach(([key, value]) => next.append(key, value instanceof File ? value : value))
    return next
  }
  let response = await fetchWithOfflineMessage(`${API_URL}/api/papers`, { method: 'POST', credentials: 'include', body: buildFormData(), headers: { [CSRF_HEADER]: await getCsrfToken() } }, UPLOAD_INTERRUPTED_HINT)
  if (response.status === 403) {
    csrfToken = null
    response = await fetchWithOfflineMessage(`${API_URL}/api/papers`, { method: 'POST', credentials: 'include', body: buildFormData(), headers: { [CSRF_HEADER]: await getCsrfToken() } }, UPLOAD_INTERRUPTED_HINT)
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

// POST /api/generation — multipart/form-data, never set Content-Type manually:
// the browser adds the multipart boundary itself when a FormData is the body.
export async function generateStudySet(input: { file: File; courseId: string; type: "FLASHCARD" | "QUIZ"; length: number; timePerQuestion?: 30 | 60; provider?: string }) {
  const problem = uploadFileProblem(input.file)
  if (problem) throw new Error(problem)
  const buildGenerationForm = () => {
    const next = new FormData()
    next.append('file', input.file)
    next.append('courseId', input.courseId)
    next.append('type', input.type)
    next.append('length', String(input.length))
    if (input.provider) next.append('provider', input.provider)
    if (input.type === 'QUIZ') {
      next.append('timePerQuestion', String(input.timePerQuestion ?? 30))
    }
    return next
  }
  let response = await fetchWithOfflineMessage(`${API_URL}/api/generation`, { method: 'POST', credentials: 'include', body: buildGenerationForm(), headers: { [CSRF_HEADER]: await getCsrfToken() } }, UPLOAD_INTERRUPTED_HINT)
  if (response.status === 403) {
    csrfToken = null
    response = await fetchWithOfflineMessage(`${API_URL}/api/generation`, { method: 'POST', credentials: 'include', body: buildGenerationForm(), headers: { [CSRF_HEADER]: await getCsrfToken() } }, UPLOAD_INTERRUPTED_HINT)
  }
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? await response.json() as { set?: GeneratedSet; code?: string; message?: string }
    : { message: response.ok ? 'The server returned an unexpected response.' : `Generation failed with status ${response.status}. Check that the backend is running.` }
  if (!response.ok) throw new Error(friendlyGenerationError(body.code, body.message))
  return body.set!
}

/**
 * Maps the backend's stable generation error codes to short, user-safe copy.
 * Raw provider detail (keys, model names, HTTP bodies) never reaches the UI —
 * it stays in the server logs for the admin to fix.
 */
function friendlyGenerationError(code: string | undefined, message: string | undefined): string {
  if (code === 'AI_BUSY') return 'The study generator is busy right now. Please try again in a moment.'
  if (code === 'AI_BAD_KEY' || code === 'AI_NOT_CONFIGURED') return 'The study generator is unavailable right now. Please try again later.'
  if (message && message.trim() && message.length < 160 && !/AIza|sk-ant|sk-|Bearer|http/i.test(message)) return message
  return 'We could not create your study set. Please try again.'
}

// GET /api/generation/providers — which AI providers this server can generate
// with, so the UI can let the user pick one (see Generate.tsx).
export function getGenerationProviders() {
  return request<{ providers: GenerationProvider[]; primary: string }>('/api/generation/providers', { method: 'GET' })
}

// Quiz history: record one finished run (server derives percent), list past
// runs newest-first, or delete one / clear all. Every page also reads the
// localStorage copy in lib/results.ts so history works even when the backend
// row is unavailable.
export function recordQuizAttempt(setId: string, input: { score: number; total: number }) {
  return request<{ attempt: QuizAttempt }>(`/api/generation/${encodeURIComponent(setId)}/attempts`, { method: 'POST', body: JSON.stringify(input) })
}
export function getQuizAttempts(page = 1, pageSize = 50) {
  return request<{ attempts: QuizAttempt[]; pagination: Pagination; stats: QuizAttemptStats }>(`/api/generation/attempts?page=${page}&pageSize=${pageSize}`, { method: 'GET' })
}
export function deleteQuizAttempt(attemptId: string) {
  return request<void>(`/api/generation/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' })
}
export function clearQuizAttempts() {
  return request<void>('/api/generation/attempts', { method: 'DELETE' })
}

export async function logout() {
  let response = await fetchWithOfflineMessage(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { [CSRF_HEADER]: await getCsrfToken() },
  })
  if (response.status === 403) {
    csrfToken = null
    response = await fetchWithOfflineMessage(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: await getCsrfToken() },
    })
  }
  if (!response.ok) throw new Error('Could not sign out.')
  invalidateProfileCache()
}

// ── Referral + missions (student side) ──────────────────────────────────────
export function getReferralInfo() {
  return request<{ referral: ReferralInfo }>('/api/profile/referral', { method: 'GET' })
}
export function getMyMissions() {
  return request<{ xp: number; tier: "FREE" | "PREMIUM"; missions: ProfileMission[] }>('/api/profile/missions', { method: 'GET' })
}
export function claimMission(missionId: string) {
  return request<{ xp: number; xpEarned: number; missionId: string }>(`/api/profile/missions/${encodeURIComponent(missionId)}/claim`, { method: 'POST', body: JSON.stringify({}) })
}
export function getMyXp() {
  return request<{ xp: number; tier: "FREE" | "PREMIUM"; premiumUntil?: string | null }>('/api/profile/xp', { method: 'GET' })
}
export function deleteAccount(confirmText: string) {
  return request<void>('/api/profile', { method: 'DELETE', body: JSON.stringify({ confirmText }) })
}

// ── Generation quota ────────────────────────────────────────────────────────
export function getGenerationQuota() {
  return request<GenerationQuota>('/api/generation/quota', { method: 'GET' })
}

// ── Admin: missions ─────────────────────────────────────────────────────────
export function getAdminMissions() {
  return request<{ missions: AdminMission[] }>('/api/admin/missions', { method: 'GET' })
}
export function createAdminMission(input: { title: string; description?: string; xpReward: number }) {
  return request<{ mission: AdminMission }>('/api/admin/missions', { method: 'POST', body: JSON.stringify(input) })
}
export function updateAdminMission(missionId: string, input: Partial<{ title: string; description: string | null; xpReward: number; isActive: boolean }>) {
  return request<{ mission: AdminMission }>(`/api/admin/missions/${encodeURIComponent(missionId)}`, { method: 'PATCH', body: JSON.stringify(input) })
}
export function deleteAdminMission(missionId: string) {
  return request<void>(`/api/admin/missions/${encodeURIComponent(missionId)}`, { method: 'DELETE' })
}

// ── Admin: promo codes (issue free Pro days / bonus XP) ─────────────────────
export type AdminPromoCode = { id: string; code: string; description: string | null; premiumDays: number; xpBonus: number; maxRedemptions: number | null; expiresAt: string | null; isActive: boolean; createdAt: string; redemptionCount: number; createdBy: string | null }

export function getAdminPromoCodes() {
  return request<{ codes: AdminPromoCode[] }>('/api/admin/promo-codes', { method: 'GET' })
}
export function createAdminPromoCode(input: { code: string; description?: string; premiumDays: number; xpBonus: number; maxRedemptions?: number | null; expiresAt?: string | null }) {
  return request<{ promo: AdminPromoCode }>('/api/admin/promo-codes', { method: 'POST', body: JSON.stringify(input) })
}
export function updateAdminPromoCode(codeId: string, input: Partial<{ description: string | null; premiumDays: number; xpBonus: number; maxRedemptions: number | null; expiresAt: string | null; isActive: boolean }>) {
  return request<{ promo: AdminPromoCode }>(`/api/admin/promo-codes/${encodeURIComponent(codeId)}`, { method: 'PATCH', body: JSON.stringify(input) })
}
export function deleteAdminPromoCode(codeId: string) {
  return request<void>(`/api/admin/promo-codes/${encodeURIComponent(codeId)}`, { method: 'DELETE' })
}

// Student side: redeem a promo code from the profile page.
export type RedeemResult = { redeemed: boolean; code: string; premiumDays: number; xpBonus: number; premiumUntil: string | null; xp: number }
export function redeemPromoCode(code: string) {
  return request<RedeemResult>('/api/profile/redeem', { method: 'POST', body: JSON.stringify({ code }) })
}
