const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export type AuthResponse = {
  profile: { id: string; email: string | null; displayName: string | null; isAdmin: boolean }
}

async function request<T>(path: string, options: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(body.message ?? 'The request could not be completed.')
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

export async function logout() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Could not sign out.')
}
