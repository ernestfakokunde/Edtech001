import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export type CreditPlan = 'FREE' | 'BASIC' | 'STUDENT_PLUS' | 'PREMIUM'
export type CreditFeature = 'LEARN' | 'QUIZ' | 'FLASHCARD'

export const AI_CREDIT_LIMITS: Record<CreditPlan, number> = {
  FREE: 20,
  BASIC: 100,
  STUDENT_PLUS: 300,
  PREMIUM: 600,
}

export class AiCreditsExhaustedError extends Error {
  readonly code = 'AI_CREDITS_EXHAUSTED'
  constructor() {
    super('AI credits exhausted')
    this.name = 'AiCreditsExhaustedError'
  }
}

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function nextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString()
}

function effectivePlan(profile: { subscriptionPlan: string; tier: 'FREE' | 'PREMIUM'; premiumUntil: Date | null }): CreditPlan {
  if (profile.tier === 'PREMIUM' && profile.subscriptionPlan === 'FREE') return 'PREMIUM'
  if (profile.premiumUntil && profile.premiumUntil <= new Date() && profile.subscriptionPlan !== 'FREE') return 'FREE'
  return profile.subscriptionPlan in AI_CREDIT_LIMITS ? profile.subscriptionPlan as CreditPlan : 'FREE'
}

async function getAccount(profileId: string) {
  const account = await prisma.profile.findUnique({ where: { id: profileId }, select: { subscriptionPlan: true, tier: true, premiumUntil: true } })
  if (!account) throw new Error('PROFILE_NOT_FOUND')
  return { ...account, plan: effectivePlan(account) }
}

export async function getAiCreditQuota(profileId: string) {
  const account = await getAccount(profileId)
  const currentMonth = monthKey()
  const used = await prisma.aiCreditUsage.aggregate({
    where: { profileId, monthKey: currentMonth, status: { in: ['RESERVED', 'COMPLETED'] } },
    _sum: { units: true },
  })
  const limit = AI_CREDIT_LIMITS[account.plan]
  const consumed = used._sum.units ?? 0
  return {
    tier: account.plan,
    limit,
    used: consumed,
    remaining: Math.max(0, limit - consumed),
    resetsAt: nextMonth(),
  }
}

export async function reserveAiCredit(profileId: string, feature: CreditFeature, requestId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.profile.findUnique({ where: { id: profileId }, select: { subscriptionPlan: true, tier: true, premiumUntil: true } })
      if (!account) throw new Error('PROFILE_NOT_FOUND')
      const plan = effectivePlan(account)
      const currentMonth = monthKey()
      const existing = await tx.aiCreditUsage.findUnique({ where: { requestId } })
      if (existing) return existing
      const usage = await tx.aiCreditUsage.aggregate({
        where: { profileId, monthKey: currentMonth, status: { in: ['RESERVED', 'COMPLETED'] } },
        _sum: { units: true },
      })
      if ((usage._sum.units ?? 0) >= AI_CREDIT_LIMITS[plan]) throw new AiCreditsExhaustedError()
      return tx.aiCreditUsage.create({ data: { profileId, monthKey: currentMonth, feature, requestId, status: 'RESERVED' } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 })
  } catch (reason) {
    if (reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === 'P2034') {
      throw new AiCreditsExhaustedError()
    }
    throw reason
  }
}

export async function completeAiCredit(id: string) {
  await prisma.aiCreditUsage.updateMany({ where: { id, status: 'RESERVED' }, data: { status: 'COMPLETED' } })
}

export async function refundAiCredit(id: string) {
  await prisma.aiCreditUsage.updateMany({ where: { id, status: 'RESERVED' }, data: { status: 'REFUNDED' } })
}
