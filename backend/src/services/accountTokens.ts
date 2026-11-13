import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Stateless, signed tokens for email verification and password reset.
 *
 * No extra table is needed: the payload names the profile, binds the token to
 * the current email (verification) or password hash (reset), and carries an
 * expiry. A reset token stops working the moment the password changes, and an
 * email token stops working if the address is changed. The HMAC key is the
 * existing SESSION_SECRET, so a leaked token cannot be forged without it.
 */
export type AccountTokenPurpose = 'verify-email' | 'reset-password'

type AccountTokenPayload = {
  /** Profile id. */
  p: string
  /** Normalized email the token was issued for. */
  e: string
  /** Expiry, epoch milliseconds. */
  x: number
  /** Purpose, so a verification link can never reset a password. */
  u: AccountTokenPurpose
  /** Reset only: fingerprint of the password hash at issue time. */
  h?: string
}

export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000
export const RESET_PASSWORD_TTL_MS = 30 * 60 * 1000

function secret() {
  return env.sessionSecret
}

function signature(encodedPayload: string) {
  return createHmac('sha256', secret()).update(encodedPayload).digest('base64url')
}

export function passwordFingerprint(passwordHash: string) {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 32)
}

export function signAccountToken(payload: AccountTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function readAccountToken(token: unknown, purpose: AccountTokenPurpose): AccountTokenPayload | null {
  if (typeof token !== 'string' || token.length < 20 || token.length > 2048) return null
  const [encoded, provided] = token.split('.')
  if (!encoded || !provided) return null

  const expected = signature(encoded)
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) return null

  let payload: AccountTokenPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AccountTokenPayload
  } catch {
    return null
  }

  if (payload?.u !== purpose) return null
  if (typeof payload.p !== 'string' || typeof payload.e !== 'string' || typeof payload.x !== 'number') return null
  if (!Number.isFinite(payload.x) || payload.x <= Date.now()) return null
  return payload
}

export function createVerificationToken(profile: { id: string; email: string }) {
  return signAccountToken({
    p: profile.id,
    e: profile.email.trim().toLowerCase(),
    x: Date.now() + VERIFY_EMAIL_TTL_MS,
    u: 'verify-email',
  })
}

export function createPasswordResetToken(profile: { id: string; email: string; passwordHash: string }) {
  return signAccountToken({
    p: profile.id,
    e: profile.email.trim().toLowerCase(),
    x: Date.now() + RESET_PASSWORD_TTL_MS,
    u: 'reset-password',
    h: passwordFingerprint(profile.passwordHash),
  })
}
