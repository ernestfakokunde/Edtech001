import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { getProfileBySession } from '../services/auth.service.js'

export type AuthenticatedRequest = Request & { profile: NonNullable<Awaited<ReturnType<typeof getProfileBySession>>>['profile'] }

function getSessionToken(request: Request) { return request.cookies?.recappedu_session as string | undefined }

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = getSessionToken(request)
  if (!token) { response.status(401).json({ message: 'You must be signed in.' }); return }
  const result = await getProfileBySession(token)
  if (!result) { response.clearCookie('recappedu_session'); response.status(401).json({ message: 'Your session has expired.' }); return }
  Object.assign(request, { profile: result.profile })
  next()
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (!(request as AuthenticatedRequest).profile.isAdmin) { response.status(403).json({ message: 'Administrator access is required.' }); return }
  next()
}

/**
 * AI, uploads and the tutor are the expensive, abusable routes, so they require
 * a confirmed address. The gate only applies when email delivery is configured:
 * a deployment without a mail provider auto-verifies sign-ups, so nobody is
 * locked out of features they cannot possibly unlock.
 */
export function requireVerifiedEmail(request: Request, response: Response, next: NextFunction) {
  const profile = (request as AuthenticatedRequest).profile
  if (env.mail.enabled && !profile.emailVerifiedAt) {
    response.status(403).json({
      message: 'Verify your email address to unlock AI practice and uploads.',
      code: 'EMAIL_NOT_VERIFIED',
    })
    return
  }
  next()
}
