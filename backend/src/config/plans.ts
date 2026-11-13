/**
 * The single source of truth for what a plan costs, what it grants, and how
 * long it lasts. Payment, entitlement expiry and AI credit limits all read
 * from here so a price or allowance can never drift between them.
 *
 * The product sells monthly access (the UI, the launch offer and the terms all
 * say "per month"), so every paid plan lasts 30 days. The legacy
 * PRO_SEMESTER_PRICE_KOBO environment variable is still accepted by env.ts for
 * old deployments, but the price itself lives in this file.
 */
export type PlanId = 'FREE' | 'BASIC' | 'STUDENT_PLUS' | 'PREMIUM'
export type PaidPlan = Exclude<PlanId, 'FREE'>

export type PlanDefinition = {
  id: PlanId
  label: string
  /** Monthly AI actions shared by Learn, quizzes and flashcards. */
  credits: number
  /** Days added to premiumUntil after a successful payment. */
  durationDays: number
  /** Price in kobo (₦1 = 100 kobo). */
  regularKobo: number
  /** Launch price charged for a student's first paid month. */
  launchKobo: number
}

export const PLAN_CATALOG = {
  FREE: { id: 'FREE', label: 'Free', credits: 20, durationDays: 0, regularKobo: 0, launchKobo: 0 },
  BASIC: { id: 'BASIC', label: 'Basic', credits: 100, durationDays: 30, regularKobo: 99900, launchKobo: 49900 },
  STUDENT_PLUS: { id: 'STUDENT_PLUS', label: 'Student Plus', credits: 300, durationDays: 30, regularKobo: 199900, launchKobo: 99900 },
  PREMIUM: { id: 'PREMIUM', label: 'Premium', credits: 600, durationDays: 30, regularKobo: 299900, launchKobo: 149900 },
} as const satisfies Record<PlanId, PlanDefinition>

export const PAID_PLAN_IDS = ['BASIC', 'STUDENT_PLUS', 'PREMIUM'] as const satisfies readonly PaidPlan[]

/** Students who can still claim the first-month launch price. */
export const LAUNCH_PLAN_CAP = 500

export function isPaidPlan(value: unknown): value is PaidPlan {
  return typeof value === 'string' && (PAID_PLAN_IDS as readonly string[]).includes(value)
}

export function planDurationDays(plan: string): number {
  if (!isPlanId(plan)) return PLAN_CATALOG.FREE.durationDays || 30
  return PLAN_CATALOG[plan].durationDays || 30
}

function isPlanId(value: string): value is PlanId {
  return Object.hasOwn(PLAN_CATALOG, value)
}
