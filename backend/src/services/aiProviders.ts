import { env, type AiProviderConfig, type AiProviderId } from '../config/env.js'
import { GoogleGenAI, Type } from '@google/genai'

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
  complete(system: string, userText: string, document?: { pdfBase64: string }): Promise<{ text: string; model: string }>
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
    document?: { pdfBase64: string },
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

const MAX_TOKENS = 16384

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
async function completeGemini(config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>> & { fallbackModels?: string[] }, system: string, userText: string, document?: { pdfBase64: string }): Promise<{ text: string; model: string }> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey })
  const generateWithModel = async (model: string): Promise<string> => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            ...(document ? [{ inlineData: { mimeType: 'application/pdf', data: document.pdfBase64 } }] : []),
            { text: `${system}\n\n${userText}` },
          ],
        }],
        config: {
          maxOutputTokens: MAX_TOKENS,
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              // A quiz item without choices cannot be rendered or graded;
              // require options at generation time rather than dropping it later.
              required: ['prompt', 'answer', 'explanation', 'options'],
            },
          },
        },
      })
      const text = response.text ?? ''
      if (!text.trim()) throw new AiProviderTransportError('Gemini', 'the model returned no text')
      return text
    } catch (error) {
      if (error instanceof AiProviderTransportError) throw error
      const detail = error instanceof Error ? error.message : String(error)
      const statusMatch = /(?:status|code)\s*[:=]?\s*(\d{3})/i.exec(detail)
      const status = statusMatch ? Number(statusMatch[1]) : undefined
      const lower = detail.toLowerCase()
      const code = status === 401 || status === 403 || lower.includes('api key not valid') || lower.includes('invalid api key')
        ? 'AI_BAD_KEY'
        : status === 429 || status === 503 ? 'AI_OVERLOADED' : 'AI_FAILED'
      throw new AiProviderTransportError('Gemini', detail, status, code)
    }
  }

  // Primary model first; when it is rate-limited or overloaded (or the model
  // id does not exist for this key), lighter sibling models from
  // GEMINI_FALLBACK_MODELS take over — they usually have spare capacity
  // during demand spikes.
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
      console.warn('[generate] Trying an alternate model after a temporary generation failure.')
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
    complete: (system, userText, document) =>
      input.complete(
        { apiKey: input.config.apiKey!, model: input.config.model, baseUrl: input.config.baseUrl!, fallbackModels: input.config.fallbackModels },
        system,
        userText,
        input.id === 'gemini' ? document : undefined,
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
  // Groq (console.groq.com, `gsk_` keys). A `gsk_` key pasted into GROK_API_KEY
  // (xAI) fails on xAI's API with an opaque auth error and a 502 here, so the
  // boot log (describeConfiguredProviders) flags a key whose prefix does not
  // match the provider it was set on.
  if (providers.groq.apiKey) {
    configured.push(makeProvider({
      id: 'groq',
      config: providers.groq,
      complete: (config, system, userText) => completeOpenAiCompatible(
        providers.groq.label,
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
    { id: 'groq', label: providers.groq.label, configured: Boolean(providers.groq.apiKey) },
    { id: 'gemini', label: providers.gemini.label, configured: Boolean(providers.gemini.apiKey) },
    { id: 'custom', label: providers.custom.label, configured: Boolean(providers.custom.apiKey && providers.custom.baseUrl) },
  ]
}

/**
 * The credential prefix each provider issues. Used only for the boot-time
 * diagnostic below: swapping two providers' keys (a `gsk_` Groq key in
 * GROK_API_KEY, say) produces a bare 401 from the upstream API that reaches a
 * student as "the study generator is unavailable" with nothing in the logs
 * pointing at the environment. Comparing prefixes catches that in one line at
 * startup, and never logs the key itself.
 */
const KEY_EXPECTATIONS: Record<AiProviderId, { prefix: string; hint: string }> = {
  anthropic: { prefix: 'sk-ant-', hint: 'console.anthropic.com' },
  openai: { prefix: 'sk-', hint: 'platform.openai.com' },
  grok: { prefix: 'xai-', hint: 'console.x.ai' },
  groq: { prefix: 'gsk_', hint: 'console.groq.com' },
  gemini: { prefix: '', hint: 'aistudio.google.com' },
  custom: { prefix: '', hint: 'your endpoint’s own key' },
}

export type ProviderDiagnostic = {
  id: AiProviderId
  label: string
  model: string
  /** False when the key's prefix does not match what this provider issues. */
  keyLooksRight: boolean
  expects: string
}

/**
 * One line per configured provider for the boot log — id, model, and whether
 * the key looks like the right kind of key. Never includes any part of a key.
 */
export function describeConfiguredProviders(): ProviderDiagnostic[] {
  const { providers } = env.ai
  return (Object.keys(providers) as AiProviderId[])
    .filter((id) => id !== 'custom' ? Boolean(providers[id].apiKey) : Boolean(providers.custom.apiKey && providers.custom.baseUrl))
    .map((id) => {
      const expectation = KEY_EXPECTATIONS[id]
      const apiKey = providers[id].apiKey ?? ''
      return {
        id,
        label: providers[id].label,
        model: providers[id].model,
        // Google currently uses more than one visible API-key prefix; let the
        // Gemini SDK/API validate credentials rather than rejecting a key here.
        keyLooksRight: !expectation.prefix || apiKey.startsWith(expectation.prefix),
        expects: expectation.hint,
      }
    })
}
