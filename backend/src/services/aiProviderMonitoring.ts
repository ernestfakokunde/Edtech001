import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { listProviderInfo } from './aiProviders.js'

export type AiProviderCallStatus = 'SUCCESS' | 'INVALID_RESPONSE' | 'FAILED'

export type AiProviderCallInput = {
  provider: string
  model: string
  feature: string
  status: AiProviderCallStatus
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
  outputCharacters?: number
  httpStatus?: number
  errorCode?: string
}

/** Persist operational metadata only. Never store source text or model output. */
export async function recordAiProviderCall(input: AiProviderCallInput) {
  try {
    await prisma.aiProviderCall.create({ data: input })
  } catch {
    // Monitoring must never make a working AI request fail.
    console.warn('[ai-monitor] Could not save provider call telemetry.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function getOpenRouterKeyStatus() {
  const provider = env.ai.providers.openrouter
  if (!provider.apiKey || !provider.baseUrl) return null

  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/key`, {
      headers: { authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      return { available: false, checkedAt: new Date().toISOString(), httpStatus: response.status }
    }
    const payload: unknown = await response.json()
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {}
    return {
      available: true,
      checkedAt: new Date().toISOString(),
      limit: finiteNumber(data.limit),
      remaining: finiteNumber(data.limit_remaining),
      usage: finiteNumber(data.usage),
      isFreeTier: data.is_free_tier === true,
    }
  } catch {
    return { available: false, checkedAt: new Date().toISOString(), httpStatus: null }
  }
}

/** Admin-only overview of the configured providers and recent request health. */
export async function getAiProviderMonitoring() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [recentCalls, groupedCalls, openRouter] = await Promise.all([
    prisma.aiProviderCall.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true, provider: true, model: true, feature: true, status: true,
        latencyMs: true, inputTokens: true, outputTokens: true, outputCharacters: true,
        httpStatus: true, errorCode: true, createdAt: true,
      },
    }),
    prisma.aiProviderCall.groupBy({
      by: ['provider', 'status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
      _max: { createdAt: true },
    }),
    getOpenRouterKeyStatus(),
  ])

  const summaries = new Map<string, { requests: number; successes: number; failures: number; invalidResponses: number; inputTokens: number; outputTokens: number; lastUsedAt: Date | null; restockNeeded: boolean }>()
  for (const group of groupedCalls) {
    const item = summaries.get(group.provider) ?? { requests: 0, successes: 0, failures: 0, invalidResponses: 0, inputTokens: 0, outputTokens: 0, lastUsedAt: null, restockNeeded: false }
    const count = group._count._all
    item.requests += count
    if (group.status === 'SUCCESS') item.successes += count
    else if (group.status === 'INVALID_RESPONSE') item.invalidResponses += count
    else item.failures += count
    item.inputTokens += group._sum.inputTokens ?? 0
    item.outputTokens += group._sum.outputTokens ?? 0
    if (group._max.createdAt && (!item.lastUsedAt || group._max.createdAt > item.lastUsedAt)) item.lastUsedAt = group._max.createdAt
    summaries.set(group.provider, item)
  }
  for (const call of recentCalls) {
    if (call.httpStatus === 402 || call.errorCode === 'RESTOCK_REQUIRED') {
      const summary = summaries.get(call.provider)
      if (summary) summary.restockNeeded = true
    }
  }
  if (openRouter?.available && !openRouter.isFreeTier && openRouter.remaining != null && openRouter.remaining <= 2) {
    const summary = summaries.get('openrouter')
    if (summary) summary.restockNeeded = true
  }

  const providers = listProviderInfo().map((provider) => ({
    ...provider,
    model: env.ai.providers[provider.id].model,
    usage30d: summaries.get(provider.id) ?? { requests: 0, successes: 0, failures: 0, invalidResponses: 0, inputTokens: 0, outputTokens: 0, lastUsedAt: null, restockNeeded: false },
  }))

  return { providers, recentCalls, openRouter, periodDays: 30 }
}
