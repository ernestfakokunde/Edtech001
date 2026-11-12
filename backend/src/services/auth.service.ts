import { createHash, randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { env } from '../config/env.js'
import { prisma, withConnectionRetry } from '../lib/prisma.js'

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

type PasswordRecord = { salt: string; hash: string }
export type SignUpInput = { email: string; password: string; displayName: string; referralCode?: string }
export type SignInInput = { email: string; password: string }

export function normalizeEmail(email: string) { return email.trim().toLowerCase() }
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

const DAILY_LOGIN_XP = 100

/** Award once per UTC calendar day; the composite key makes parallel sign-ins safe. */
async function awardDailyLoginXp(profileId: string) {
  const rewardDay = new Date().toISOString().slice(0, 10)
  return prisma.$transaction(async (transaction) => {
    // ON CONFLICT makes simultaneous sign-ins safe without a read-then-write race.
    const inserted = await transaction.$queryRaw<{ xpAwarded: number }[]>`
      INSERT INTO "DailyLoginReward" ("profileId", "rewardDay", "xpAwarded")
      VALUES (${profileId}, ${rewardDay}, ${DAILY_LOGIN_XP})
      ON CONFLICT ("profileId", "rewardDay") DO NOTHING
      RETURNING "xpAwarded"
    `
    if (inserted.length === 0) {
      const profile = await transaction.profile.findUnique({ where: { id: profileId }, select: { xp: true } })
      return { xp: profile?.xp ?? 0, xpEarned: 0, rewardDay }
    }
    const profile = await transaction.profile.update({ where: { id: profileId }, data: { xp: { increment: inserted[0].xpAwarded } }, select: { xp: true } })
    await transaction.auditEvent.create({ data: { actorId: profileId, action: 'DAILY_LOGIN_REWARD', entityType: 'Profile', entityId: profileId, metadata: { xpEarned: inserted[0].xpAwarded, rewardDay } } })
    return { xp: profile.xp, xpEarned: inserted[0].xpAwarded, rewardDay }
  }, { maxWait: 10000, timeout: 15000 })
}

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

/**
 * A real scrypt record checked when the email does not exist. Without it,
 * unknown addresses return materially faster than wrong passwords and the
 * endpoint becomes an account-enumeration oracle.
 */
const DUMMY_PASSWORD_HASH = JSON.stringify({
  salt: '0'.repeat(32),
  hash: scryptSync('recappedu-not-a-real-password', '0'.repeat(32), 64).toString('hex'),
} satisfies PasswordRecord)

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

const REFERRAL_XP_BONUS = 20

/**
 * Pays the referrer once per verified invitee. The audit row is the ledger:
 * a second call finds it and does nothing, so verification retries are safe.
 */
async function awardReferralXp(inviteeId: string) {
  const invitee = await prisma.profile.findUnique({ where: { id: inviteeId }, select: { id: true, referredById: true } })
  if (!invitee?.referredById) return
  const alreadyPaid = await prisma.auditEvent.findFirst({
    where: { action: 'REFERRAL_ACCEPTED', entityType: 'Profile', entityId: inviteeId },
    select: { id: true },
  })
  if (alreadyPaid) return
  await prisma.$transaction([
    prisma.profile.update({ where: { id: invitee.referredById }, data: { xp: { increment: REFERRAL_XP_BONUS } } }),
    prisma.auditEvent.create({
      data: {
        actorId: invitee.referredById,
        action: 'REFERRAL_ACCEPTED',
        entityType: 'Profile',
        entityId: inviteeId,
        metadata: { xpBonus: REFERRAL_XP_BONUS },
      },
    }),
  ])
}

/**
 * Marks the address verified exactly once. Returns false when it was already
 * verified (or the id/email pair does not match), which callers treat as
 * idempotent success after checking the email.
 */
export async function markEmailVerified(profileId: string, email: string) {
  const claimed = await prisma.profile.updateMany({
    where: { id: profileId, email: normalizeEmail(email), emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  })
  if (claimed.count !== 1) return false
  await prisma.auditEvent.create({
    data: { actorId: profileId, action: 'EMAIL_VERIFIED', entityType: 'Profile', entityId: profileId },
  })
  await awardReferralXp(profileId)
  return true
}

export async function findProfileForPasswordReset(email: string) {
  return prisma.profile.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, email: true, displayName: true, passwordHash: true, emailVerifiedAt: true },
  })
}

/**
 * Replaces the password, proves email ownership at the same time, and revokes
 * every existing session so a stolen cookie cannot outlive the reset.
 */
export async function replacePassword(profileId: string, password: string) {
  const passwordHash = await hashPassword(password)
  await prisma.$transaction([
    prisma.profile.update({
      where: { id: profileId },
      data: { passwordHash, emailVerifiedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { profileId } }),
    prisma.auditEvent.create({
      data: { actorId: profileId, action: 'PASSWORD_RESET_COMPLETED', entityType: 'Profile', entityId: profileId },
    }),
  ])
}

export async function recordPasswordResetRequest(profileId: string) {
  await prisma.auditEvent.create({
    data: { actorId: profileId, action: 'PASSWORD_RESET_REQUESTED', entityType: 'Profile', entityId: profileId },
  }).catch(() => undefined)
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
        // Without a mail provider nobody can complete verification, so the
        // account is verified immediately instead of being permanently gated.
        emailVerifiedAt: env.mail.enabled ? null : new Date(),
      },
    })

    // Record the signup so the admin activity feed can surface the latest
    // registrations alongside referrals and moderation actions.
    await prisma.auditEvent.create({
      data: { actorId: profile.id, action: 'SIGNUP', entityType: 'Profile', entityId: profile.id, metadata: { email } },
    })

    // If the student joined through an invite, link them to the referrer. The
    // XP bonus is only paid once the invitee proves control of their email, so
    // throwaway sign-ups cannot farm referral points.
    const referrer = await findReferrer(input.referralCode)
    if (referrer) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { referredById: referrer.id },
      })
    }
    if (!env.mail.enabled) await awardReferralXp(profile.id)

    if (isPermanentAdminEmail(email)) {
      profile.isAdmin = true
      void persistPermanentAdmin(profile.id)
    }
    const dailyLoginReward = await awardDailyLoginXp(profile.id)
    const token = await createSession(profile.id)
    const { passwordHash: _passwordHash, ...safeProfile } = { ...profile, xp: dailyLoginReward.xp }
    return { token, profile: safeProfile, dailyLoginReward }
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
        isAdmin: true, emailVerifiedAt: true, tier: true, subscriptionPlan: true, xp: true, referralCode: true, premiumUntil: true,
        suspendedUntil: true, createdAt: true,
      },
    })
    if (!profile || !(await verifyPassword(input.password, profile?.passwordHash ?? DUMMY_PASSWORD_HASH))) throw new Error('Invalid login credentials')
    if (isPermanentAdminEmail(email) && !profile.isAdmin) {
      profile.isAdmin = true
      void persistPermanentAdmin(profile.id)
    }

    const dailyLoginReward = await awardDailyLoginXp(profile.id)
    const token = await createSession(profile.id)
    // Never hand the hash back to the controller.
    const { passwordHash: _passwordHash, ...safeProfile } = { ...profile, xp: dailyLoginReward.xp }
    return { token, profile: safeProfile, dailyLoginReward }
  })
}

async function loadProfileBySession(token: string) {
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

// API pages often load several resources at once, and each authenticated route
// checks the same cookie. Share only the active lookup among those requests;
// once it settles, the next request still revalidates the session with the DB.
type SessionLookup = ReturnType<typeof loadProfileBySession>
const pendingSessionLookups = new Map<string, SessionLookup>()

export function getProfileBySession(token: string) {
  const pending = pendingSessionLookups.get(token)
  if (pending) return pending
  const lookup = loadProfileBySession(token).finally(() => {
    if (pendingSessionLookups.get(token) === lookup) pendingSessionLookups.delete(token)
  })
  pendingSessionLookups.set(token, lookup)
  return lookup
}

export async function deleteSession(token: string) { return withConnectionRetry(() => prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })) }
