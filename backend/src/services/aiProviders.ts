import { env, type AiProviderConfig, type AiProviderId } from '../config/env.js'
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai'

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
  complete(system: string, userText: string, document?: { pdfBase64: string }, format?: 'json' | 'text'): Promise<{ text: string; model: string }>
  /**
   * Streaming variant for the study tutor. Yields text chunks as the model
   * writes them so the UI can show an answer building up instead of a spinner
   * for the whole round trip. Generation (JSON arrays) does not stream: it has
   * to be parsed and validated as a whole before anything is stored.
   */
  completeStream?(system: string, userText: string, document?: { pdfBase64: string }): AsyncGenerator<string>
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
    format?: 'json' | 'text',
  ) => Promise<{ text: string; model: string }>
  /** Optional streaming implementation for the interactive study tutor. */
  stream?: (
    config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>> & { baseUrl?: string; fallbackModels?: string[] },
    system: string,
    userText: string,
    document?: { pdfBase64: string },
  ) => AsyncGenerator<string>
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
// Interactive tutor replies should fail over promptly instead of leaving the
// chat in its loading state indefinitely. Longer generation jobs keep the
// existing retry behavior.
const CHAT_PROVIDER_TIMEOUT_MS = 45_000

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
  timeoutMs?: number,
): Promise<unknown> {
  let lastError: AiProviderTransportError | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
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
const MAX_CHAT_TOKENS = 1200

/** Anthropic Messages API — https://platform.anthropic.com/docs/api/messages */
async function completeAnthropic(config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>>, system: string, userText: string, _document?: { pdfBase64: string }, format: 'json' | 'text' = 'json'): Promise<{ text: string; model: string }> {
  const data = await postJson('Anthropic', 'https://api.anthropic.com/v1/messages', {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }, {
    model: config.model,
    max_tokens: format === 'text' ? MAX_CHAT_TOKENS : MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: userText }],
  }, format === 'text' ? 1 : MAX_ATTEMPTS, format === 'text' ? CHAT_PROVIDER_TIMEOUT_MS : undefined)

  const blocks = isRecord(data) && Array.isArray(data.content) ? data.content : []
  const text = blocks
    .filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => (block as { text: string }).text)
    .join('\n')
  if (!text.trim()) throw new AiProviderTransportError('Anthropic', 'the model returned no text')
  return { text, model: config.model }
}

/**
 * Streams a chat reply from the Anthropic Messages API. Anthropic's streaming
 * events are `message_start`, `content_block_start`, `content_block_delta`
 * (the actual text lives in `delta.text`), `content_block_end`, `message_delta`
 * and `message_stop`. Only `content_block_delta` events carry text, so the
 * others are skipped.
 *
 * Interactive chats get one attempt — see streamOpenAiCompatible.
 */
async function* streamAnthropic(
  config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>>,
  system: string,
  userText: string,
): AsyncGenerator<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_PROVIDER_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: MAX_CHAT_TOKENS,
        system,
        messages: [{ role: 'user', content: userText }],
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (reason) {
    throw new AiProviderTransportError('Anthropic', reason instanceof Error ? reason.message : 'network error')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => '')
    throw new AiProviderTransportError('Anthropic', raw.slice(0, 200) || `HTTP ${response.status}`, response.status)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawStop = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split(/\n\n/)
      buffer = events.pop() ?? ''
      for (const event of events) {
        const lines = event.split('\n')
        const dataLine = lines.find((line) => line.startsWith('data:'))
        if (!dataLine) continue
        if (dataLine.slice(5).trim() === '[DONE]') { sawStop = true; return }
        const data = safeJson(dataLine.slice(5))
        if (!isRecord(data) || data.type !== 'content_block_delta') continue
        const delta = data.delta
        if (isRecord(delta) && typeof delta.text === 'string' && delta.text) yield delta.text
      }
    }
  } catch (reason) {
    throw new AiProviderTransportError('Anthropic', reason instanceof Error ? reason.message : 'stream interrupted')
  }
  if (!sawStop) throw new AiProviderTransportError('Anthropic', 'stream ended without message_stop')
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
  format: 'json' | 'text' = 'json',
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
    max_tokens: format === 'text' ? MAX_CHAT_TOKENS : MAX_TOKENS,
    temperature: 0,
    stream: false,
  }, format === 'text' ? 1 : MAX_ATTEMPTS, format === 'text' ? CHAT_PROVIDER_TIMEOUT_MS : undefined)

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

/**
 * Streams a chat reply from an OpenAI-compatible endpoint. The wire format is
 * Server-Sent Events: each line is `data: {...}` and the stream ends with
 * `data: [DONE]`. A chunk carries the next piece of the answer in
 * `choices[0].delta.content`; the first chunk is often empty, so a chunk with
 * no delta is skipped rather than emitted as a blank.
 *
 * Interactive chats get one attempt: a transport failure here fails over to
 * the next provider in the service layer, and a second attempt would mean
 * re-sending the whole prompt for no benefit.
 */
async function* streamOpenAiCompatible(
  providerLabel: string,
  config: Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
  system: string,
  userText: string,
  document?: { pdfBase64: string },
): AsyncGenerator<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_PROVIDER_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
        max_tokens: MAX_CHAT_TOKENS,
        temperature: 0,
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (reason) {
    throw new AiProviderTransportError(providerLabel, reason instanceof Error ? reason.message : 'network error')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => '')
    const reason = raw.slice(0, 200) || `HTTP ${response.status}`
    throw new AiProviderTransportError(providerLabel, reason, response.status)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') { sawDone = true; return }
        const data = safeJson(payload)
        if (!isRecord(data) || !Array.isArray(data.choices)) continue
        const choice = data.choices[0]
        if (!isRecord(choice) || !isRecord(choice.delta)) continue
        const content = choice.delta.content
        if (typeof content === 'string' && content) yield content
      }
    }
  } catch (reason) {
    throw new AiProviderTransportError(providerLabel, reason instanceof Error ? reason.message : 'stream interrupted')
  }
  if (!sawDone) throw new AiProviderTransportError(providerLabel, 'stream ended without [DONE]')
}

/** Google Gemini generateContent API — https://ai.google.dev/api/generate-content */
async function completeGemini(config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>> & { fallbackModels?: string[] }, system: string, userText: string, document?: { pdfBase64: string }, format: 'json' | 'text' = 'json'): Promise<{ text: string; model: string }> {
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
          maxOutputTokens: format === 'text' ? MAX_CHAT_TOKENS : MAX_TOKENS,
          temperature: 0,
          ...(format === 'text' ? { abortSignal: AbortSignal.timeout(CHAT_PROVIDER_TIMEOUT_MS) } : {}),
          ...(format === 'text' && model.startsWith('gemini-3.') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
          responseMimeType: format === 'json' ? 'application/json' : 'text/plain',
          ...(format === 'json' ? { responseSchema: {
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
          } } : {}),
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
  // Keep interactive chats bounded; service-level provider failover will try
  // the next configured provider after a timeout or upstream error.
  const models = format === 'text' ? [config.model] : [config.model, ...(config.fallbackModels ?? [])]
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

/**
 * Streams a chat reply from the Gemini generateContent API. The SDK's
 * `generateContentStream` yields `GenerateContentResponse` objects whose
 * `.text` holds the next chunk; concatenating them gives the full reply.
 *
 * Only the primary model is used for chat — the multi-model cascade is for
 * structured generation, where a wrong shape costs a whole round trip.
 */
async function* streamGemini(
  config: Required<Pick<AiProviderConfig, 'apiKey' | 'model'>> & { fallbackModels?: string[] },
  system: string,
  userText: string,
  document?: { pdfBase64: string },
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHAT_PROVIDER_TIMEOUT_MS)
  let empty = true
  try {
    const stream = await ai.models.generateContentStream({
      model: config.model,
      contents: [{
        role: 'user',
        parts: [
          ...(document ? [{ inlineData: { mimeType: 'application/pdf', data: document.pdfBase64 } }] : []),
          { text: `${system}\n\n${userText}` },
        ],
      }],
      config: {
        maxOutputTokens: MAX_CHAT_TOKENS,
        temperature: 0,
        abortSignal: controller.signal,
        // Gemini 3.x thinks before it answers; for a chat reply the student
        // wants words on screen fast, so cap thinking at minimal.
        ...(config.model.startsWith('gemini-3.') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        responseMimeType: 'text/plain',
      },
    })
    for await (const chunk of stream) {
      const text = chunk.text ?? ''
      if (text) { empty = false; yield text }
    }
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
  } finally {
    clearTimeout(timer)
  }
  if (empty) throw new AiProviderTransportError('Gemini', 'the model returned no text')
}

function makeProvider(input: ProviderInput): AiProvider {
  const provider: AiProvider = {
    id: input.id,
    label: input.config.label,
    model: input.config.model,
    complete: (system, userText, document, format = 'json') =>
      input.complete(
        { apiKey: input.config.apiKey!, model: input.config.model, baseUrl: input.config.baseUrl!, fallbackModels: input.config.fallbackModels },
        system,
        userText,
        input.id === 'gemini' ? document : undefined,
        format,
      ),
  }
  if (!input.stream) return provider
  return { ...provider, completeStream: input.stream.bind(undefined, { apiKey: input.config.apiKey!, model: input.config.model, baseUrl: input.config.baseUrl!, fallbackModels: input.config.fallbackModels }) }
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
    configured.push(makeProvider({ id: 'anthropic', config: providers.anthropic, complete: completeAnthropic, stream: streamAnthropic }))
  }
  if (providers.openai.apiKey) {
    configured.push(makeProvider({
      id: 'openai',
      config: providers.openai,
      complete: (config, system, userText, _document, format = 'json') => completeOpenAiCompatible(
        providers.openai.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
        format,
      ),
      stream: (config, system, userText) => streamOpenAiCompatible(
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
      complete: (config, system, userText, _document, format = 'json') => completeOpenAiCompatible(
        providers.grok.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
        format,
      ),
      stream: (config, system, userText) => streamOpenAiCompatible(
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
      complete: (config, system, userText, _document, format = 'json') => completeOpenAiCompatible(
        providers.groq.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
        format,
      ),
      stream: (config, system, userText) => streamOpenAiCompatible(
        providers.groq.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
      ),
    }))
  }
  if (providers.gemini.apiKey) {
    configured.push(makeProvider({ id: 'gemini', config: providers.gemini, complete: completeGemini, stream: streamGemini }))
  }
  if (providers.custom.apiKey && providers.custom.baseUrl) {
    configured.push(makeProvider({
      id: 'custom',
      config: providers.custom,
      complete: (config, system, userText, _document, format = 'json') => completeOpenAiCompatible(
        providers.custom.label,
        config as Required<Pick<AiProviderConfig, 'apiKey' | 'model' | 'baseUrl'>>,
        system,
        userText,
        format,
      ),
      stream: (config, system, userText) => streamOpenAiCompatible(
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
