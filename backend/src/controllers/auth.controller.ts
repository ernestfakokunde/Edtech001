import type { Request, Response } from 'express'
import { deleteSession, signIn, signUp } from '../services/auth.service.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 30 }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'An unexpected error occurred.' }

export async function signup(request: Request, response: Response) {
  const { email, password, displayName } = request.body as Partial<{ email: string; password: string; displayName: string }>
  if (!email || !password || !displayName || password.length < 8) { response.status(400).json({ message: 'displayName, email, and a password of at least 8 characters are required.' }); return }
  try { const result = await signUp({ email, password, displayName }); response.cookie('recappedu_session', result.token, cookieOptions); response.status(201).json({ profile: result.profile }) } catch (error) { response.status(400).json({ message: errorMessage(error) }) }
}

export async function login(request: Request, response: Response) {
  const { email, password } = request.body as Partial<{ email: string; password: string }>
  if (!email || !password) { response.status(400).json({ message: 'email and password are required.' }); return }
  try { const result = await signIn({ email, password }); response.cookie('recappedu_session', result.token, cookieOptions); response.json({ profile: result.profile }) } catch (error) { response.status(401).json({ message: errorMessage(error) }) }
}

export async function logout(request: Request, response: Response) { const token = request.cookies?.recappedu_session as string | undefined; if (token) await deleteSession(token); response.clearCookie('recappedu_session'); response.status(204).send() }
export async function me(request: Request, response: Response) { response.json({ profile: (request as AuthenticatedRequest).profile }) }
