import type { Request, Response } from 'express'
import { deleteSession, signIn, signUp } from '../services/auth.service.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { Prisma } from '@prisma/client'

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 30 }
function isDuplicateEmail(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes('email') }
function isDatabaseError(error: unknown) { return error instanceof Prisma.PrismaClientInitializationError || (error instanceof Error && /P100[1-3]|P1017|Can't reach database server|connection.*(?:failed|closed|timed out)|\btimed out/i.test(error.message)) }

export async function signup(request: Request, response: Response) {
  const { email, password, displayName, referralCode } = request.body as Partial<{ email: string; password: string; displayName: string; referralCode?: string }>
  if (!email || !password || !displayName || password.length < 8) { response.status(400).json({ message: 'displayName, email, and a password of at least 8 characters are required.' }); return }
  try { const result = await signUp({ email, password, displayName, referralCode }); response.cookie('recappedu_session', result.token, cookieOptions); response.status(201).json({ profile: result.profile }) } catch (error) { if (isDuplicateEmail(error)) { response.status(409).json({ message: 'An account with that email already exists.' }); return } response.status(500).json({ message: 'Could not create your account.' }) }
}

export async function login(request: Request, response: Response) {
  const { email, password } = request.body as Partial<{ email: string; password: string }>
  if (!email || !password) { response.status(400).json({ message: 'email and password are required.' }); return }
  try {
    const result = await signIn({ email, password })
    response.cookie('recappedu_session', result.token, cookieOptions)
    response.json({ profile: result.profile })
  } catch (error) {
    if (isDatabaseError(error)) { response.status(503).json({ message: 'The database is temporarily unavailable. Please try again in a moment.' }); return }
    response.status(401).json({ message: error instanceof Error ? error.message : 'Invalid email or password.' })
  }
}

export async function logout(request: Request, response: Response) { const token = request.cookies?.recappedu_session as string | undefined; if (token) await deleteSession(token); response.clearCookie('recappedu_session'); response.status(204).send() }
export async function me(request: Request, response: Response) { response.json({ profile: (request as AuthenticatedRequest).profile }) }
