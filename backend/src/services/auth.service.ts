import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { prisma, withConnectionRetry } from '../lib/prisma.js'

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

type PasswordRecord = { salt: string; hash: string }
export type SignUpInput = { email: string; password: string; displayName: string; referralCode?: string }
export type SignInInput = { email: string; password: string }

function normalizeEmail(email: string) { return email.trim().toLowerCase() }
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

/**
 * The main administrator account is pinned by its email address so the admin
 * tab never silently disappears. Any sign-in / session for this address is
 * always treated as admin, and the DB flag is re-applied in the background so
 * persistence follows (even if a previous migration or manual edit dropped it).
 */
export const RECAPP_ADMIN_EMAIL = 'recappadmin@edu.com'
export const isPermanentAdminEmail = (email: string | null | undefined) => normalizeEmail(email ?? '') === RECAPP_ADMIN_EMAIL

function normalizeReferralCode(code: string | null | undefined) {
  return (code ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
}

function referralCode(candidate: string) {
  // re- + 10 characters from a URL-safe alphabet.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = ''
  for (let index = 0; index < 10; index += 1) {
    value += alphabet[randomBytes(1)[0] % alphabet.length]
  }
  return `${candidate.slice(0, 3)}-${value}`
}

/** Unique referral invite code for a new account. */
export function generateReferralCode(seed = 're') {
  return referralCode(seed)
}

/** Marks the given profile as admin in the DB (awaited by callers that need it). */
export async function persistPermanentAdmin(profileId: string) {
  try { await prisma.profile.update({ where: { id: profileId }, data: { isAdmin: true } }) } catch { /* non-fatal */ }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return JSON.stringify({ salt, hash: derivedKey.toString('hex') } satisfies PasswordRecord)
}

async function verifyPassword(password: string, stored: string) {
  const record = JSON.parse(stored) as PasswordRecord
  const derivedKey = await scrypt(password, record.salt, 64) as Buffer
  return timingSafeEqual(Buffer.from(record.hash, 'hex'), derivedKey)
}

async function createSession(profileId: string) {
  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({ data: { tokenHash: hashToken(token), profileId, expiresAt: new Date(Date.now() + SESSION_DURATION_MS) } })
  return token
}

async function findReferrer(referralCodeInput: string | undefined) {
  const code = normalizeReferralCode(referralCodeInput)
  if (!code) return null
  return prisma.profile.findFirst({ where: { referralCode: { equals: code, mode: 'insensitive' } }, select: { id: true, referralCode: true } })
}

export async function signUp(input: SignUpInput) {
  return withConnectionRetry(async () => {
    const email = normalizeEmail(input.email)
    const profile = await prisma.profile.create({
      data: {
        email,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName.trim(),
        referralCode: generateReferralCode(input.displayName.trim().split(/\s+/)[0] ?? 're'),
      },
    })

    // Record the signup so the admin activity feed can surface the latest
    // registrations alongside referrals and moderation actions.
    await prisma.auditEvent.create({
      data: { actorId: profile.id, action: 'SIGNUP', entityType: 'Profile', entityId: profile.id, metadata: { email } },
    })

    // If the student joined through an invite, link them to the referrer and
    // credit the referrer with bonus XP. Both steps are best-effort: an invalid
    // code is ignored rather than blocking signup.
    const referrer = await findReferrer(input.referralCode)
    if (referrer) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { referredById: referrer.id },
      })
      await prisma.profile.update({
        where: { id: referrer.id },
        data: { xp: { increment: 20 } },
      })
      await prisma.auditEvent.create({
        data: { actorId: referrer.id, action: 'REFERRAL_ACCEPTED', entityType: 'Profile', entityId: profile.id, metadata: { referredEmail: email, xpBonus: 20 } },
      })
    }

    if (isPermanentAdminEmail(email)) {
      profile.isAdmin = true
      void persistPermanentAdmin(profile.id)
    }
    const token = await createSession(profile.id)
    const { passwordHash: _passwordHash, ...safeProfile } = profile
    return { token, profile: safeProfile }
  })
}

export async function signIn(input: SignInInput) {
  return withConnectionRetry(async () => {
    const email = normalizeEmail(input.email)
    // Only the columns the client needs — a slimmer row means a smaller payload
    // and a faster round trip on the login path.
    const profile = await prisma.profile.findUnique({
      where: { email },
      select: {
        id: true, email: true, passwordHash: true, displayName: true, username: true,
        isAdmin: true, tier: true, xp: true, referralCode: true, premiumUntil: true,
        suspendedUntil: true, createdAt: true,
      },
    })
    if (!profile || !(await verifyPassword(input.password, profile.passwordHash))) throw new Error('Invalid login credentials')
    if (isPermanentAdminEmail(email) && !profile.isAdmin) {
      profile.isAdmin = true
      void persistPermanentAdmin(profile.id)
    }
    const token = await createSession(profile.id)
    // Never hand the hash back to the controller.
    const { passwordHash: _passwordHash, ...safeProfile } = profile
    return { token, profile: safeProfile }
  })
}

export async function getProfileBySession(token: string) {
  return withConnectionRetry(async () => {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { profile: true } })
    if (!session || session.expiresAt <= new Date()) return null
    if (session.profile.suspendedUntil && session.profile.suspendedUntil > new Date()) return null
    if (isPermanentAdminEmail(session.profile.email)) {
      session.profile.isAdmin = true
      void persistPermanentAdmin(session.profile.id)
    }
    // The password hash stays in the database: every API response built from this
    // profile (including /api/auth/me) is hash-free.
    const { passwordHash: _passwordHash, ...safeProfile } = session.profile
    return { session, profile: safeProfile }
  })
}

export async function deleteSession(token: string) { return withConnectionRetry(() => prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })) }
