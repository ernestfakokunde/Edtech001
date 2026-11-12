import type { Request, Response } from 'express'
import {
  deleteSession,
  findProfileForPasswordReset,
  markEmailVerified,
  normalizeEmail,
  recordPasswordResetRequest,
  replacePassword,
  signIn,
  signUp,
} from '../services/auth.service.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import {
  createPasswordResetToken,
  createVerificationToken,
  passwordFingerprint,
  readAccountToken,
} from '../services/accountTokens.js'
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mail.service.js'

// `sameSite` is env-driven so one build serves a same-site frontend (lax, the
// default) and a cross-site one (COOKIE_SAME_SITE=none). `secure` follows
// NODE_ENV, which Render sets to production for deployed services.
const cookieOptions = { httpOnly: true, sameSite: env.cookieSameSite, secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 30 }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 200
const MAX_EMAIL_LENGTH = 254
const GENERIC_RESET_MESSAGE = 'If that email has an account, a reset link is on its way. Check your inbox and spam folder.'

function isDuplicateEmail(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes('email') }
function isDatabaseError(error: unknown) { return error instanceof Prisma.PrismaClientInitializationError || (error instanceof Error && /P100[1-3]|P1017|Can't reach database server|connection.*(?:failed|closed|timed out)|\btimed out/i.test(error.message)) }

function readEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim()
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : null
}

function readPassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) return null
  return value
}

async function sendVerification(profile: { id: string; email: string; displayName: string | null }) {
  const token = createVerificationToken(profile)
  return sendVerificationEmail({ email: profile.email, displayName: profile.displayName, token })
}

export async function signup(request: Request, response: Response) {
  const { email: rawEmail, password: rawPassword, displayName: rawName, referralCode } = request.body as Partial<{ email: string; password: string; displayName: string; referralCode?: string }>
  const email = readEmail(rawEmail)
  const password = readPassword(rawPassword)
  const displayName = typeof rawName === 'string' ? rawName.trim() : ''
  if (!email) { response.status(400).json({ message: 'Enter a valid email address.' }); return }
  if (!password) { response.status(400).json({ message: `Choose a password between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.` }); return }
  if (displayName.length < 2 || displayName.length > 80) { response.status(400).json({ message: 'Enter the name you want shown on your profile.' }); return }

  try {
    const result = await signUp({ email, password, displayName, referralCode })
    let verificationSent = false
    if (!result.profile.emailVerifiedAt && env.mail.enabled) {
      try {
        verificationSent = await sendVerification(result.profile)
      } catch {
        // The account exists and can request another link; signup must not fail
        // because the mail provider is briefly unavailable.
        console.error('[auth/signup] verification email could not be delivered')
      }
    }
    response.cookie('recappedu_session', result.token, cookieOptions)
    response.status(201).json({ profile: result.profile, verificationSent })
  } catch (error) {
    if (isDuplicateEmail(error)) { response.status(409).json({ message: 'An account with that email already exists.' }); return }
    if (isDatabaseError(error)) { response.status(503).json({ message: 'The database is temporarily unavailable. Please try again in a moment.' }); return }
    console.error('[auth/signup]', error)
    response.status(500).json({ message: 'Could not create your account. Please try again.' })
  }
}

export async function login(request: Request, response: Response) {
  const { email: rawEmail, password } = request.body as Partial<{ email: string; password: string }>
  const email = readEmail(rawEmail)
  if (!email || typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    response.status(400).json({ message: 'Enter your email and password.' })
    return
  }
  try {
    const result = await signIn({ email, password })
    response.cookie('recappedu_session', result.token, cookieOptions)
    response.json({ profile: result.profile })
  } catch (error) {
    if (isDatabaseError(error)) { response.status(503).json({ message: 'The database is temporarily unavailable. Please try again in a moment.' }); return }
    if (error instanceof Error && error.message === 'Invalid login credentials') { response.status(401).json({ message: 'That email and password do not match an account.' }); return }
    console.error('[auth/login]', error)
    response.status(500).json({ message: 'We could not sign you in right now. Please try again in a moment.' })
  }
}

export async function forgotPassword(request: Request, response: Response) {
  const email = readEmail((request.body as { email?: unknown } | undefined)?.email)
  // Always answer with the same message so this endpoint never reveals which
  // addresses have accounts.
  if (!email) { response.json({ message: GENERIC_RESET_MESSAGE }); return }

  try {
    const profile = await findProfileForPasswordReset(email)
    if (profile) {
      await recordPasswordResetRequest(profile.id)
      const token = createPasswordResetToken(profile)
      try {
        await sendPasswordResetEmail({ email: profile.email, displayName: profile.displayName, token })
      } catch {
        console.error('[auth/forgot-password] reset email could not be delivered')
      }
    }
  } catch (error) {
    // Never turn a database hiccup into an account-existence signal.
    console.error('[auth/forgot-password]', error)
  }
  response.json({ message: GENERIC_RESET_MESSAGE })
}

export async function resetPassword(request: Request, response: Response) {
  const body = request.body as Partial<{ token: unknown; password: unknown }>
  const password = readPassword(body.password)
  if (!password) {
    response.status(400).json({ message: `Choose a new password between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.` })
    return
  }

  const payload = readAccountToken(body.token, 'reset-password')
  if (!payload || !payload.h) {
    response.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one from the sign-in page.' })
    return
  }

  try {
    const profile = await findProfileForPasswordReset(payload.e)
    if (!profile || profile.id !== payload.p || passwordFingerprint(profile.passwordHash) !== payload.h) {
      response.status(400).json({ message: 'This reset link is invalid or has expired. Request a new one from the sign-in page.' })
      return
    }
    await replacePassword(profile.id, password)
    response.status(204).send()
  } catch (error) {
    console.error('[auth/reset-password]', error)
    response.status(500).json({ message: 'We could not update your password just now. Please try again.' })
  }
}

export async function verifyEmail(request: Request, response: Response) {
  const payload = readAccountToken((request.body as { token?: unknown } | undefined)?.token, 'verify-email')
  if (!payload) {
    response.status(400).json({ message: 'This verification link is invalid or has expired. Request a new email from your study desk.' })
    return
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { id: payload.p }, select: { id: true, email: true, emailVerifiedAt: true } })
    if (!profile || normalizeEmail(profile.email) !== payload.e) {
      response.status(400).json({ message: 'This verification link no longer matches an account.' })
      return
    }
    if (!profile.emailVerifiedAt) await markEmailVerified(profile.id, profile.email)
    response.json({ verified: true, alreadyVerified: Boolean(profile.emailVerifiedAt) })
  } catch (error) {
    console.error('[auth/verify-email]', error)
    response.status(500).json({ message: 'We could not verify that link just now. Please try again.' })
  }
}

export async function resendVerification(request: Request, response: Response) {
  const profile = (request as AuthenticatedRequest).profile
  if (profile.emailVerifiedAt) { response.status(204).send(); return }
  if (!env.mail.enabled) {
    response.status(503).json({ message: 'Email delivery is not configured on this server yet. Contact support to verify your account.' })
    return
  }
  try {
    await sendVerification(profile)
    response.json({ sent: true })
  } catch (error) {
    console.error('[auth/resend-verification]', error)
    response.status(502).json({ message: 'We could not send that email just now. Please try again shortly.' })
  }
}

export async function logout(request: Request, response: Response) { const token = request.cookies?.recappedu_session as string | undefined; if (token) await deleteSession(token); response.clearCookie('recappedu_session'); response.status(204).send() }
export async function me(request: Request, response: Response) { response.json({ profile: (request as AuthenticatedRequest).profile }) }
