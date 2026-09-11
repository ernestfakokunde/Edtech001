import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { prisma, withConnectionRetry } from '../lib/prisma.js'

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

type PasswordRecord = { salt: string; hash: string }
export type SignUpInput = { email: string; password: string; displayName: string }
export type SignInInput = { email: string; password: string }

function normalizeEmail(email: string) { return email.trim().toLowerCase() }
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

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

export async function signUp(input: SignUpInput) {
  return withConnectionRetry(async () => {
    const email = normalizeEmail(input.email)
    const profile = await prisma.profile.create({ data: { email, passwordHash: await hashPassword(input.password), displayName: input.displayName.trim() } })
    const token = await createSession(profile.id)
    return { token, profile }
  })
}

export async function signIn(input: SignInInput) {
  return withConnectionRetry(async () => {
    const email = normalizeEmail(input.email)
    const profile = await prisma.profile.findUnique({ where: { email } })
    if (!profile || !(await verifyPassword(input.password, profile.passwordHash))) throw new Error('Invalid login credentials')
    const token = await createSession(profile.id)
    return { token, profile }
  })
}

export async function getProfileBySession(token: string) {
  return withConnectionRetry(async () => {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { profile: true } })
    if (!session || session.expiresAt <= new Date()) return null
    if (session.profile.suspendedUntil && session.profile.suspendedUntil > new Date()) return null
    return { session, profile: session.profile }
  })
}

export async function deleteSession(token: string) { return withConnectionRetry(() => prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })) }
