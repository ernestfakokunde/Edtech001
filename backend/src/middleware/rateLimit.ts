import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'

/**
 * A small fixed-window limiter that needs no external store.
 *
 * Render serves this API from a single instance, so a process-local counter is
 * enough today. The map is swept on a timer and hard-capped, and keys are
 * namespaced per limiter, so the auth and AI routes never share a budget. When
 * the service scales horizontally, swap the Map for Redis/Upstash while keeping
 * these exported limiters and their budgets unchanged.
 */
type Bucket = { count: number; resetAt: number }

const MAX_BUCKETS = 50_000
const buckets = new Map<string, Bucket>()

const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 60_000)
sweeper.unref?.()

export type RateLimitOptions = {
  name: string
  windowMs: number
  max: number
  message?: string
  /** Return null to fall back to the caller's IP. */
  key?: (request: Request) => string | null
}

function clientIp(request: Request) {
  return request.ip ?? request.socket?.remoteAddress ?? 'unknown'
}

function normalizedEmail(request: Request) {
  const email = (request.body as { email?: unknown } | undefined)?.email
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function authenticatedId(request: Request) {
  const profile = (request as Request & { profile?: { id?: string } }).profile
  return profile?.id ?? null
}

export function createRateLimit(options: RateLimitOptions) {
  return function rateLimit(request: Request, response: Response, next: NextFunction) {
    if (env.rateLimitDisabled) { next(); return }

    const identity = options.key?.(request) ?? `ip:${clientIp(request)}`
    const key = `${options.name}:${identity}`
    const now = Date.now()

    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && buckets.size >= MAX_BUCKETS) {
        // Refuse new keys rather than let memory grow without bound. Existing
        // callers keep their normal budget.
        response.setHeader('Retry-After', '60')
        response.status(429).json({ message: 'Too many attempts. Please wait a moment and try again.', code: 'RATE_LIMITED', retryAfter: 60 })
        return
      }
      bucket = { count: 0, resetAt: now + options.windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    const remaining = Math.max(0, options.max - bucket.count)
    response.setHeader('RateLimit-Limit', String(options.max))
    response.setHeader('RateLimit-Remaining', String(remaining))
    response.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      response.setHeader('Retry-After', String(retryAfter))
      response.status(429).json({
        message: options.message ?? 'Too many attempts. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
        retryAfter,
      })
      return
    }

    next()
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/* ---------------------------------------------------------------- auth ---- */

export const csrfLimit = createRateLimit({
  name: 'csrf',
  windowMs: MINUTE,
  max: 300,
  message: 'Too many session refreshes. Please wait a moment and try again.',
})

export const signupLimit = createRateLimit({
  name: 'signup',
  windowMs: HOUR,
  max: 20,
  message: 'Too many accounts were created from this connection. Please try again later.',
})

export const loginIpLimit = createRateLimit({
  name: 'login-ip',
  windowMs: 15 * MINUTE,
  max: 100,
  message: 'Too many sign-in attempts from this connection. Please wait a few minutes and try again.',
})

export const loginAccountLimit = createRateLimit({
  name: 'login-account',
  windowMs: 15 * MINUTE,
  max: 10,
  message: 'Too many sign-in attempts for this account. Please wait a few minutes and try again.',
  key: (request) => { const email = normalizedEmail(request); return email ? `email:${email}` : null },
})

export const forgotPasswordIpLimit = createRateLimit({
  name: 'forgot-ip',
  windowMs: HOUR,
  max: 30,
  message: 'Too many reset requests from this connection. Please try again later.',
})

export const forgotPasswordAccountLimit = createRateLimit({
  name: 'forgot-account',
  windowMs: HOUR,
  max: 5,
  message: 'Too many reset requests for this account. Please try again later.',
  key: (request) => { const email = normalizedEmail(request); return email ? `email:${email}` : null },
})

export const resetPasswordLimit = createRateLimit({
  name: 'reset-password',
  windowMs: HOUR,
  max: 10,
  message: 'Too many password resets. Please request a fresh link later.',
})

export const verifyEmailLimit = createRateLimit({
  name: 'verify-email',
  windowMs: HOUR,
  max: 20,
  message: 'Too many verification attempts. Please try again later.',
})

export const resendVerificationLimit = createRateLimit({
  name: 'resend-verification',
  windowMs: 10 * MINUTE,
  max: 3,
  message: 'Please wait a few minutes before requesting another verification email.',
  key: authenticatedId,
})

/* ------------------------------------------------------- product routes ---- */

export const generationLimit = createRateLimit({
  name: 'generation',
  windowMs: HOUR,
  max: 30,
  message: 'You have generated several sets recently. Please wait a little before creating another.',
  key: authenticatedId,
})

export const chatLimit = createRateLimit({
  name: 'learn-chat',
  windowMs: HOUR,
  max: 60,
  message: 'Your tutor needs a short break. Please continue in a few minutes.',
  key: authenticatedId,
})

export const uploadLimit = createRateLimit({
  name: 'upload',
  windowMs: HOUR,
  max: 20,
  message: 'You have uploaded several documents recently. Please try again later.',
  key: authenticatedId,
})

export const promoRedeemLimit = createRateLimit({
  name: 'promo-redeem',
  windowMs: HOUR,
  max: 10,
  message: 'Too many code attempts. Please try again later.',
  key: authenticatedId,
})

/**
 * Every checkout call writes a Payment row and asks Paystack for a new
 * transaction, so a stuck "Pay" button must not be able to fan out.
 */
export const checkoutLimit = createRateLimit({
  name: 'checkout',
  windowMs: 15 * MINUTE,
  max: 6,
  message: 'You have started several checkouts recently. Finish the open one or wait a few minutes.',
  key: authenticatedId,
})
