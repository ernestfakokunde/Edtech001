import { env, type AiProviderConfig, type AiProviderId } from '../config/env.js'

/**
 * A ready-to-call AI provider. `complete()` returns the raw completion text
 * (already unwrapped from the provider's response envelope); the caller is
 * responsible for parsing and strictly validating the JSON payload it contains.
 *
 * To add a new provider: give it an id in env.ts, read its credentials there,
 * drop an adapter here that satisfies this interface, and register it in
 * `getConfiguredProviders()`. That's the whole integration — validation, prompt
 * building, failover and metadata flow through the shared ai.service.
 */
export type AiProvider = {
  id: AiProviderId
  label: string
  model: string
  complete(system: string, userText: string): Promise<{ text: string; model: string }>
}

/** Thrown when a provider's HTTP call fails (transport error, non-2xx, or an empty body). */
export class AiProviderTransportError extends Error {
  /** HTTP status when the failure came from a response; absent for network errors. */
  status?: number
  /** Machine-readable category so the controller can return a clean user message. */
  code: 'AI_BAD_KEY' | 'AI_OVERLOADED' | 'AI_FAILED' = 'AI_FAILED'
  constructor(providerLabel: string, detail: string, status?: number, code: 'AI_BAD_KEY' | 'AI_OVERLOADED' | 'AI_FAILED' = 'AI_FAILED') {
    super(`${providerLabel} request failed: ${detail}`)
    this.name = 'AiProviderTransportError'
    this.status = status
    this.code = code
  }
}

type ProviderInput = {
  id: AiProviderId
  config: AiProviderConfig
  complete: (
    config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>> & { baseUrl?: string; fallbackModels?: string[] },
    system: string,
    userText: string,
  ) => Promise<{ text: string; model: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

// Transient upstream failures worth retrying: rate limits, overloads, and
// momentary blips. Non-retryable failures (invalid key, permission denied,
// bad request) throw on the first attempt so provider failover isn't delayed.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3 // 1 initial attempt + 2 retries
const BASE_BACKOFF_MS = 800
const MAX_BACKOFF_MS = 8000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Shared POST + JSON body helper. Retries transient upstream failures (429 /
 * 5xx and network blips) with exponential backoff — Google's "high demand"
 * overloads are exactly this case — while failing fast on non-retryable
 * errors so the service layer can move on to the next provider. Keeps a
 * single place for error handling so every provider reports failures the
 * same way. The raw body is read as text so a non-JSON error page is
 * included in the failure detail instead of crashing.
 */
async function postJson(
  providerLabel: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<unknown> {
  let lastError: AiProviderTransportError | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
    } catch (reason) {
      lastError = new AiProviderTransportError(providerLabel, reason instanceof Error ? reason.message : 'network error')
      if (attempt < maxAttempts) { await sleep(BASE_BACKOFF_MS * attempt); continue }
      throw lastError
    }

    const raw = await response.text().catch(() => '')
    const data = raw ? safeJson(raw) : undefined
    if (!response.ok) {
      // Most providers surface a human-readable API error as { error: { message } }.
      const reason = isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string'
        ? data.error.message
        : raw.slice(0, 200) || `HTTP ${response.status}`
      if (!RETRYABLE_STATUS.has(response.status) || attempt === maxAttempts) {
        const exhausted = RETRYABLE_STATUS.has(response.status) ? ` (still failing after ${maxAttempts} attempts)` : ''
        throw new AiProviderTransportError(providerLabel, `${reason}${exhausted}`, response.status)
      }
      // Honor Retry-After when the provider sends one, capped so an
      // interactive request never stalls for long.
      const retryAfter = Number(response.headers.get('retry-after'))
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, MAX_BACKOFF_MS)
        : Math.min(BASE_BACKOFF_MS * attempt, MAX_BACKOFF_MS)
      if (Number.isFinite(retryAfter) && retryAfter * 1000 > MAX_BACKOFF_MS) {
        // The provider asked us to wait longer than we're willing to stall —
        // fail now so a configured fallback provider gets its turn sooner.
        throw new AiProviderTransportError(providerLabel, `${reason} (asked to retry in ${retryAfter}s)`, response.status)
      }
      await sleep(waitMs)
      continue
    }
    if (data === undefined) {
      throw new AiProviderTransportError(providerLabel, `HTTP ${response.status}: empty response body`, response.status)
    }
    return data
  }
  throw lastError ?? new AiProviderTransportError(providerLabel, 'exhausted retry attempts')
}

const MAX_TOKENS = 8192

/** Anthropic Messages API — https://platform.anthropic.com/docs/api/messages */
async function completeAnthropic(config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>>, system: string, userText: string): Promise<{ text: string; model: string }> {
  const data = await postJson('Anthropic', 'https://api.anthropic.com/v1/messages', {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }, {
    model: config.model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: userText }],
  })

  const blocks = isRecord(data) && Array.isArray(data.content) ? data.content : []
  const text = blocks
    .filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => (block as { text: string }).text)
    .join('\n')
  if (!text.trim()) throw new AiProviderTransportError('Anthropic', 'the model returned no text')
  return { text, model: config.model }
}

/**
 * OpenAI-compatible Chat Completions — used verbatim by OpenAI, Grok (xAI) and
 * any custom endpoint (DeepSeek, Mistral, OpenRouter, LM Studio, …).
 */
async function completeOpenAiCompatible(
  providerLabel: string,
  config: Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
  system: string,
  userText: string,
): Promise<{ text: string; model: string }> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const data = await postJson(providerLabel, `${baseUrl}/chat/completions`, {
    authorization: `Bearer ${config.apiKey}`,
  }, {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0,
    stream: false,
  })

  function firstMessageContent(): string {
    if (!isRecord(data) || !Array.isArray(data.choices)) return ''
    const choice = data.choices[0]
    if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== 'string') return ''
    return choice.message.content
  }

  const text = firstMessageContent()
  if (!text.trim()) throw new AiProviderTransportError(providerLabel, 'the model returned no text')
  return { text, model: config.model }
}

/** Google Gemini generateContent API — https://ai.google.dev/api/generate-content */
async function completeGemini(config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>> & { fallbackModels?: string[] }, system: string, userText: string): Promise<{ text: string; model: string }> {
  const generateWithModel = async (model: string): Promise<string> => {
    // One attempt per model here: the sibling cascade below is the retry loop,
    // so a hot-spike 503 on flash moves to flash-lite immediately instead of
    // burning 3 backoff retries on the same model first.
    const data = await postJson(
      'Gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': config.apiKey },
      {
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userText}` }] }],
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0 },
      },
      1,
    )

    const candidates = isRecord(data) && Array.isArray(data.candidates) ? data.candidates : []
    const parts = candidates[0] && isRecord(candidates[0]) && isRecord(candidates[0].content) && Array.isArray(candidates[0].content.parts)
      ? candidates[0].content.parts
      : []
    const text = parts
      .filter((part) => isRecord(part) && typeof part.text === 'string')
      .map((part) => (part as { text: string }).text)
      .join('\n')
    if (!text.trim()) throw new AiProviderTransportError('Gemini', 'the model returned no text')
    return text
  }

  // Primary model first; when it is rate-limited or overloaded (or the model
  // id does not exist for this key), lighter sibling models from
  // GEMINI_FALLBACK_MODELS take over — they usually have spare capacity
  // during demand spikes.
  const key = (config.apiKey ?? '').trim()
  if (!key.startsWith('AIza')) {
    // Genuine Gemini keys start with "AIza"; anything else (a pasted URL, a
    // truncated secret, another provider's key) fails with an opaque 400 on
    // every sibling, so reject it directly with a fixable message instead.
    // The message stays internal (server logs); the controller maps the
    // AI_BAD_KEY code to a short user-facing message.
    throw new AiProviderTransportError('Gemini', 'the configured GEMINI_API_KEY does not look like a valid Google API key (it should start with "AIza")', 401, 'AI_BAD_KEY')
  }
  const models = [config.model, ...(config.fallbackModels ?? [])]
  const attempts: string[] = []
  let lastStatus: number | undefined
  for (let index = 0; index < models.length; index++) {
    try {
      const text = await generateWithModel(models[index])
      return { text, model: models[index] }
    } catch (error) {
      // Cascade across every model: a transient overload (or per-model 404)
      // on flash tries flash-lite, then 2.0-flash, before giving up.
      // Non-retryable failures (bad key, permissions) repeat identically on
      // every sibling, so stop and surface them instead.
      const status = error instanceof AiProviderTransportError ? error.status : undefined
      lastStatus = status
      const detail = error instanceof Error
        ? error.message.replace(/^Gemini request failed:\s*/, '')
        : String(error)
      attempts.push(`${models[index]} failed: ${detail}`)
      const retryable = (status === undefined || status === 404 || (typeof status === 'number' && RETRYABLE_STATUS.has(status)))
      if (!retryable) throw error
      console.warn(`[generate] Gemini model "${models[index]}" unavailable — trying the next one`)
    }
  }
  throw new AiProviderTransportError(
    'Gemini',
    models.length > 1
      ? `all ${models.length} Gemini models failed (${attempts.join(' | ')})`
      : (attempts[0] ?? 'no model could be reached'),
    lastStatus,
  )
}

function makeProvider(input: ProviderInput): AiProvider {
  return {
    id: input.id,
    label: input.config.label,
    model: input.config.model,
    complete: (system, userText) =>
      input.complete(
        { apiKey: input.config.apiKey!, model: input.config.model, baseUrl: input.config.baseUrl!, fallbackModels: input.config.fallbackModels },
        system,
        userText,
      ),
  }
}

/**
 * Every currently-configured provider, in a stable registration order. A
 * provider is considered configured as soon as its API key (and, for the
 * custom OpenAI-compatible endpoint, its base URL) is set.
 */
export function getConfiguredProviders(): AiProvider[] {
  const { providers } = env.ai
  const configured: AiProvider[] = []

  if (providers.anthropic.apiKey) {
    configured.push(makeProvider({ id: 'anthropic', config: providers.anthropic, complete: completeAnthropic }))
  }
  if (providers.openai.apiKey) {
    configured.push(makeProvider({
      id: 'openai',
      config: providers.openai,
      complete: (config, system, userText) => completeOpenAiCompatible(
        providers.openai.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
      ),
    }))
  }
  if (providers.grok.apiKey) {
    configured.push(makeProvider({
      id: 'grok',
      config: providers.grok,
      complete: (config, system, userText) => completeOpenAiCompatible(
        providers.grok.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
      ),
    }))
  }
  if (providers.gemini.apiKey) {
    configured.push(makeProvider({ id: 'gemini', config: providers.gemini, complete: completeGemini }))
  }
  if (providers.custom.apiKey && providers.custom.baseUrl) {
    configured.push(makeProvider({
      id: 'custom',
      config: providers.custom,
      complete: (config, system, userText) => completeOpenAiCompatible(
        providers.custom.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
      ),
    }))
  }

  return configured
}

export type ProviderInfo = { id: AiProviderId; label: string; configured: boolean }

/** Metadata for every supported provider (configured or not) for GET /api/generation/providers. */
export function listProviderInfo(): ProviderInfo[] {
  const { providers } = env.ai
  return [
    { id: 'anthropic', label: providers.anthropic.label, configured: Boolean(providers.anthropic.apiKey) },
    { id: 'openai', label: providers.openai.label, configured: Boolean(providers.openai.apiKey) },
    { id: 'grok', label: providers.grok.label, configured: Boolean(providers.grok.apiKey) },
    { id: 'gemini', label: providers.gemini.label, configured: Boolean(providers.gemini.apiKey) },
    { id: 'custom', label: providers.custom.label, configured: Boolean(providers.custom.apiKey && providers.custom.baseUrl) },
  ]
}