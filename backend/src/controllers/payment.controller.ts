import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'

const PAYSTACK_API = 'https://api.paystack.co'
const PRO_DAYS = 90

function profileId(request: Request) { return (request as AuthenticatedRequest).profile.id }

async function paystackRequest<T>(path: string, init: RequestInit): Promise<T> {
  if (!env.paystack.secretKey) throw new Error('PAYMENT_NOT_CONFIGURED')
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.paystack.secretKey}`, 'content-type': 'application/json', ...init.headers },
  })
  const payload = await response.json() as { status?: boolean; message?: string; data?: T }
  if (!response.ok || payload.status !== true || payload.data === undefined) throw new Error('PAYMENT_REQUEST_FAILED')
  return payload.data
}

type InitializedTransaction = { authorization_url: string; reference: string }
type VerifiedTransaction = { status: string; reference: string; amount: number; currency: string; customer?: { email?: string } }

export async function initializeProCheckout(request: Request, response: Response) {
  const amount = env.paystack.semesterPriceKobo
  if (!env.paystack.secretKey || !Number.isSafeInteger(amount) || amount <= 0) {
    response.status(503).json({ message: 'Pro checkout is not available right now.' }); return
  }
  const profile = await prisma.profile.findUnique({ where: { id: profileId(request) }, select: { id: true, email: true, premiumUntil: true, tier: true } })
  if (!profile) { response.status(404).json({ message: 'Profile not found.' }); return }
  if (profile.tier === 'PREMIUM' && profile.premiumUntil && profile.premiumUntil > new Date()) {
    response.status(409).json({ message: 'Your Pro plan is already active.' }); return
  }

  const reference = `recapp_${Date.now()}_${randomBytes(8).toString('hex')}`
  try {
    await prisma.payment.create({ data: { profileId: profile.id, reference, amount, currency: 'NGN' } })
    const transaction = await paystackRequest<InitializedTransaction>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({ email: profile.email, amount, currency: 'NGN', reference, callback_url: env.paystack.frontendReturnUrl, metadata: { profileId: profile.id, plan: 'semester-pro' } }),
    })
    if (transaction.reference !== reference || !transaction.authorization_url.startsWith('https://checkout.paystack.com/')) throw new Error('PAYMENT_BAD_CHECKOUT')
    response.json({ authorizationUrl: transaction.authorization_url })
  } catch {
    await prisma.payment.updateMany({ where: { reference, status: 'PENDING' }, data: { status: 'FAILED' } }).catch(() => undefined)
    response.status(502).json({ message: 'Could not start checkout. Please try again.' })
  }
}

export async function getProPricing(_request: Request, response: Response) {
  const amount = env.paystack.semesterPriceKobo
  response.json({ available: Boolean(env.paystack.secretKey && Number.isSafeInteger(amount) && amount > 0), amountNaira: Number.isSafeInteger(amount) && amount > 0 ? amount / 100 : null, durationDays: PRO_DAYS, currency: 'NGN' })
}

async function verifyAndGrant(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference } })
  if (!payment || payment.status === 'SUCCESS') return
  const verified = await paystackRequest<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' })
  if (verified.reference !== payment.reference || verified.status !== 'success' || verified.amount !== payment.amount || verified.currency !== payment.currency) {
    if (verified.status === 'failed' || verified.status === 'abandoned' || verified.status === 'success') {
      await prisma.payment.updateMany({ where: { reference, status: 'PENDING' }, data: { status: 'FAILED' } })
    }
    return
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'SUCCESS', paidAt: new Date() } })
    if (claimed.count !== 1) return
    const user = await tx.profile.findUnique({ where: { id: payment.profileId }, select: { premiumUntil: true } })
    if (!user) throw new Error('PAYMENT_PROFILE_MISSING')
    const base = user.premiumUntil && user.premiumUntil > new Date() ? user.premiumUntil : new Date()
    const expiry = new Date(base.getTime() + PRO_DAYS * 24 * 60 * 60 * 1000)
    await tx.profile.update({ where: { id: payment.profileId }, data: { tier: 'PREMIUM', premiumUntil: expiry } })
    await tx.auditEvent.create({ data: { actorId: payment.profileId, action: 'PRO_PAYMENT_CONFIRMED', entityType: 'Payment', entityId: payment.id, metadata: { reference, amount: payment.amount, currency: payment.currency, premiumUntil: expiry.toISOString() } } })
  }, { maxWait: 10000, timeout: 15000 })
}

export async function paystackWebhook(request: Request, response: Response) {
  const secret = env.paystack.secretKey
  const rawBody = request.body as Buffer
  const signature = request.header('x-paystack-signature')
  if (!secret || !Buffer.isBuffer(rawBody) || !signature) { response.sendStatus(400); return }
  const expected = createHmac('sha512', secret).update(rawBody).digest()
  let received: Buffer
  try { received = Buffer.from(signature, 'hex') } catch { response.sendStatus(401); return }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) { response.sendStatus(401); return }

  let event: { event?: string; data?: { reference?: string; status?: string } }
  try { event = JSON.parse(rawBody.toString('utf8')) as typeof event } catch { response.sendStatus(400); return }
  if (typeof event.data?.reference !== 'string') { response.sendStatus(200); return }
  if (event.event === 'charge.failed') {
    try {
      await prisma.payment.updateMany({ where: { reference: event.data.reference, status: 'PENDING' }, data: { status: 'FAILED' } })
      response.sendStatus(200)
    } catch { response.sendStatus(500) }
    return
  }
  if (event.event !== 'charge.success') { response.sendStatus(200); return }
  try {
    await verifyAndGrant(event.data.reference)
    response.sendStatus(200)
  } catch {
    // Non-2xx lets Paystack retry; processing is idempotent by reference/status.
    response.sendStatus(500)
  }
}

export async function getPaymentStatus(request: Request, response: Response) {
  const reference = typeof request.query.reference === 'string' ? request.query.reference : ''
  const [payment, profile] = await Promise.all([
    prisma.payment.findFirst({ where: { reference, profileId: profileId(request) }, select: { status: true, createdAt: true } }),
    prisma.profile.findUnique({ where: { id: profileId(request) }, select: { tier: true, premiumUntil: true } }),
  ])
  if (!payment) { response.status(404).json({ message: 'Payment not found.' }); return }
  response.json({ status: payment.status, createdAt: payment.createdAt, tier: profile?.tier, premiumUntil: profile?.premiumUntil })
}

/** Daily cleanup; entitlement checks also honor expiry immediately. */
export async function expireProPlans() {
  await prisma.profile.updateMany({ where: { tier: 'PREMIUM', premiumUntil: { lte: new Date() } }, data: { tier: 'FREE' } })
}
