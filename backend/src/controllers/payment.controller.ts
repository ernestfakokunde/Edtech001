import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { LAUNCH_PLAN_CAP, PAID_PLAN_IDS, PLAN_CATALOG, isPaidPlan, planDurationDays } from '../config/plans.js'
import { prisma } from '../lib/prisma.js'

const PAYSTACK_API = 'https://api.paystack.co'
/** A pending checkout holds a launch slot for this long. */
const LAUNCH_RESERVATION_MS = 30 * 60 * 1000

function launchClaimWhere(): Prisma.PaymentWhereInput {
  return {
    launchPrice: true,
    OR: [
      { status: 'SUCCESS' },
      { status: 'PENDING', createdAt: { gte: new Date(Date.now() - LAUNCH_RESERVATION_MS) } },
    ],
  }
}

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
  const body = request.body as { plan?: unknown }
  if (!isPaidPlan(body.plan)) { response.status(400).json({ message: 'Choose a valid paid plan.' }); return }
  const plan = body.plan
  if (!env.paystack.secretKey) { response.status(503).json({ message: 'Checkout is not available right now.' }); return }
  const profile = await prisma.profile.findUnique({ where: { id: profileId(request) }, select: { id: true, email: true, premiumUntil: true, tier: true } })
  if (!profile) { response.status(404).json({ message: 'Profile not found.' }); return }
  const reference = `recapp_${Date.now()}_${randomBytes(8).toString('hex')}`

  try {
    /**
     * Serializable so two simultaneous checkouts cannot both see "499 launch
     * slots claimed" and both get the launch price. The 30-minute pending
     * window reserves a slot while the student is still on Paystack.
     */
    const payment = await prisma.$transaction(async (transaction) => {
      const priorPaid = await transaction.payment.findFirst({ where: { profileId: profile.id, status: 'SUCCESS' }, select: { id: true } })
      const claimed = await transaction.payment.count({ where: launchClaimWhere() })
      const launchPrice = !priorPaid && claimed < LAUNCH_PLAN_CAP
      const amount = launchPrice ? PLAN_CATALOG[plan].launchKobo : PLAN_CATALOG[plan].regularKobo
      return transaction.payment.create({ data: { profileId: profile.id, reference, amount, currency: 'NGN', plan, launchPrice } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 })

    const transaction = await paystackRequest<InitializedTransaction>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({ email: profile.email, amount: payment.amount, currency: 'NGN', reference, callback_url: env.paystack.frontendReturnUrl, metadata: { profileId: profile.id, plan, launchPrice: payment.launchPrice } }),
    })
    if (transaction.reference !== reference || !transaction.authorization_url.startsWith('https://checkout.paystack.com/')) throw new Error('PAYMENT_BAD_CHECKOUT')
    response.json({
      authorizationUrl: transaction.authorization_url,
      amountNaira: payment.amount / 100,
      launchPrice: payment.launchPrice,
      durationDays: PLAN_CATALOG[plan].durationDays,
    })
  } catch (error) {
    await prisma.payment.updateMany({ where: { reference, status: 'PENDING' }, data: { status: 'FAILED' } }).catch(() => undefined)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      // Another checkout changed the launch count at the same instant; a
      // retry recomputes the current price instead of overselling the offer.
      response.status(409).json({ message: 'Checkout was busy for a moment. Please try again.', code: 'CHECKOUT_RETRY' })
      return
    }
    response.status(502).json({ message: 'Could not start checkout. Please try again.' })
  }
}

export async function getProPricing(_request: Request, response: Response) {
  const claimed = await prisma.payment.count({ where: launchClaimWhere() })
  response.json({
    available: Boolean(env.paystack.secretKey),
    launchSpotsRemaining: Math.max(0, LAUNCH_PLAN_CAP - claimed),
    currency: 'NGN',
    plans: Object.fromEntries(PAID_PLAN_IDS.map((id) => [id, {
      label: PLAN_CATALOG[id].label,
      credits: PLAN_CATALOG[id].credits,
      durationDays: PLAN_CATALOG[id].durationDays,
      regularNaira: PLAN_CATALOG[id].regularKobo / 100,
      launchNaira: PLAN_CATALOG[id].launchKobo / 100,
    }])),
  })
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
    const expiry = new Date(base.getTime() + planDurationDays(payment.plan) * 24 * 60 * 60 * 1000)
    await tx.profile.update({ where: { id: payment.profileId }, data: { tier: 'PREMIUM', subscriptionPlan: payment.plan, premiumUntil: expiry } })
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
  const paymentDetails = await prisma.payment.findFirst({ where: { reference, profileId: profileId(request) }, select: { plan: true } })
  response.json({ status: payment.status, createdAt: payment.createdAt, tier: profile?.tier, plan: paymentDetails?.plan ?? 'FREE', premiumUntil: profile?.premiumUntil })
}

/** Daily cleanup; entitlement checks also honor expiry immediately. */
export async function expireProPlans() {
  await prisma.profile.updateMany({ where: { tier: 'PREMIUM', premiumUntil: { lte: new Date() } }, data: { tier: 'FREE', subscriptionPlan: 'FREE' } })
}
