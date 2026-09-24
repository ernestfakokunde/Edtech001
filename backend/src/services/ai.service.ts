import { env, type AiProviderId } from '../config/env.js'
import { getConfiguredProviders, listProviderInfo, type AiProvider } from './aiProviders.js'

export type GeneratedSetKind = 'FLASHCARD' | 'QUIZ'

/**
 * A single item after strict server-side validation of the AI's response.
 * `metadata` is persisted on Question.metadata so future debugging can see
 * exactly which provider/model/prompt produced an item (open decision in the
 * generate handoff spec — we store provider/model/promptVersion, plus the
 * multiple-choice options for QUIZ items).
 */
export type GeneratedItem = {
  prompt: string
  answer: string
  explanation: string | null
  metadata: {
    provider: string
    model: string
    promptVersion: string
    options?: string[]
  }
}

const PROMPT_VERSION = '2'
const MAX_PROMPT_CHARACTERS = 60_000

const SYSTEM_PROMPT =
  'You are an expert study assistant. You read past-paper and course documents and turn them into precise, exam-relevant flashcards or multiple-choice quiz questions. Only ever use content present in the document you are given.'

export class AiNotConfiguredError extends Error {
  constructor(requested?: string | null) {
    super(
      requested
        ? `The "${requested}" provider is not configured on this server. Ask an admin to enable it, or pick one of the configured providers.`
        : 'The AI service is not configured. Ask an admin to set an API key for Anthropic, OpenAI, Grok, Gemini, or a custom provider.',
    )
    this.name = 'AiNotConfiguredError'
  }
}

export type GenerationOptions = {
  /** Provider requested by the client (must be configured). Defaults to AI_PROVIDER with AI_FALLBACK_PROVIDERS. */
  provider?: string | null
}

export type ProviderListing = ReturnType<typeof listProviderInfo>

/** True when at least one AI provider has credentials configured. */
export function isAiConfigured(): boolean {
  return getConfiguredProviders().length > 0
}

/** Every supported provider and whether it can be used right now (GET /api/generation/providers). */
export function listGenerationProviders(): ProviderListing {
  return listProviderInfo()
}

export class GenerationFailedError extends Error {
  /** Short code the frontend can map to friendly copy without parsing text. */
  code: 'AI_BAD_KEY' | 'AI_BUSY' | 'AI_FAILED'
  constructor(code: 'AI_BAD_KEY' | 'AI_BUSY' | 'AI_FAILED', internalDetail: string) {
    super(internalDetail)
    this.name = 'GenerationFailedError'
    this.code = code
  }
}

function generationFailureCode(failures: string[]): 'AI_BAD_KEY' | 'AI_BUSY' | 'AI_FAILED' {
  const joined = failures.join(' ').toLowerCase()
  if (joined.includes('ai_bad_key') || joined.includes('does not look like a valid google api key') || joined.includes('api key not valid') || joined.includes('invalid api key') || joined.includes('incorrect api key') || joined.includes('permission_denied') || joined.includes('unauthenticated')) {
    return 'AI_BAD_KEY'
  }
  if (joined.includes('overloaded') || joined.includes('rate') || joined.includes('429') || joined.includes('503') || joined.includes('all ') && joined.includes('models failed')) {
    return 'AI_BUSY'
  }
  return 'AI_FAILED'
}

/**
 * Sends the extracted document text to a configured AI provider and asks for a
 * deterministic JSON array of study items. The response is NOT trusted: it is
 * parsed and shape-validated before the controller writes anything to the
 * database. If a provider fails (transport error, invalid JSON, wrong shape or
 * wrong count) we retry with the next provider in the chain rather than
 * surfacing a partial failure.
 *
 * The thrown GenerationFailedError carries the full internal detail in
 * `message` (server logs) and a short stable `code` for the controller to map
 * to user-facing copy — the raw provider text never reaches the UI.
 */
export async function generateStudyItems(input: { text: string; kind: GeneratedSetKind; length: number }, options: GenerationOptions = {}): Promise<GeneratedItem[]> {
  const candidates = resolveCandidates(options.provider)
  if (candidates.length === 0) throw new AiNotConfiguredError(options.provider)

  const failures: string[] = []
  for (const provider of candidates) {
    try {
      const { text: payload, model } = await provider.complete(SYSTEM_PROMPT, buildPrompt(input))
      return mapItems(JSON.parse(parseJsonPayload(payload)) as unknown[], input.kind, provider.id, model, input.length)
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason)
      failures.push(`[${provider.label} / ${provider.model}] ${detail}`)
      console.warn(`[generate] provider "${provider.id}" failed — ${detail}`)
    }
  }

  throw new GenerationFailedError(generationFailureCode(failures), `No AI provider could generate the study set. ${failures.join(' | ')}`)
}

/**
 * Builds the ordered list of providers to try:
 * 1. a client-requested provider (that one alone),
 * 2. otherwise the configured primary (AI_PROVIDER) followed by each
 *    configured fallback (AI_FALLBACK_PROVIDERS) in order, deduplicated,
 * 3. and as a last resort every other configured provider in registration
 *    order — so a single key (e.g. only GEMINI_API_KEY) works with no extra
 *    env config instead of erroring while a provider is ready to serve.
 */
function resolveCandidates(requested: string | null | undefined): AiProvider[] {
  const configured = getConfiguredProviders()
  if (requested) {
    const match = configured.find((provider) => provider.id === requested)
    return match ? [match] : []
  }

  const order = [env.ai.provider, ...env.ai.fallbacks]
  const seen = new Set<AiProviderId>()
  const candidates: AiProvider[] = []
  for (const providerId of order) {
    if (seen.has(providerId)) continue
    seen.add(providerId)
    const match = configured.find((provider) => provider.id === providerId)
    if (match) candidates.push(match)
  }
  for (const provider of configured) {
    if (seen.has(provider.id)) continue
    candidates.push(provider)
  }
  return candidates
}

function buildPrompt({ text, kind, length }: { text: string; kind: GeneratedSetKind; length: number }) {
  const isQuiz = kind === 'QUIZ'
  return [
    `Read the document below carefully and create exactly ${length} ${isQuiz ? 'multiple-choice quiz questions' : 'flashcard items'} from its most examinable concepts.`,
    '',
    'Requirements:',
    '- Base every item strictly on the source document; do not invent facts.',
    '- The items should help a university student prepare for an exam in the course the document belongs to.',
    ...(isQuiz
      ? ['- Every quiz question is multiple choice with exactly 4 options and exactly one correct answer.',
        '- The answer field must be the correct option, copied verbatim from the options array, so it can be compared as a string.']
      : ['- Keep the prompt short and focused; make the answer a complete, self-contained explanation.']),
    '- Add a one or two sentence explanation per item.',
    '',
    `Respond with ONLY one JSON array of exactly ${length} objects and no other text. Use this exact shape:`,
    isQuiz
      ? '[{"prompt":"question text","answer":"correct option copied verbatim from options","explanation":"why this is correct","options":["option A","option B","option C","option D"]}]'
      : '[{"prompt":"question text","answer":"concise factual answer","explanation":"optional short note"}]',
    '',
    'Then the document text:',
    '',
    text.slice(0, MAX_PROMPT_CHARACTERS),
  ].join('\n')
}
/**
 * The model will sometimes wrap the JSON in a ```json fenced code block, add
 * prose before it, or append notes after the closing fence — so an exact fence
 * match is too strict (a real Gemini failure mode). Extract the outermost JSON
 * array instead; JSON.parse then reports any genuinely malformed payload.
 */
function parseJsonPayload(payload: string): string {
  const trimmed = payload.trim()
  const start = trimmed.indexOf('[')
  const end = trimmed.lastIndexOf(']')
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

/**
 * Validates the raw AI output and maps it to clean GeneratedItem values.
 * Throws (the controller turns this into a 502) if the shape or count is
 * off — we never write unvalidated AI output to the database.
 */
function mapItems(raw: unknown[], kind: GeneratedSetKind, providerId: string, model: string, expectedLength: number): GeneratedItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('The AI did not return a JSON array. Please try again.')
  }

  const items: GeneratedItem[] = []
  for (const entry of raw) {
    const parsed = parseItem(entry, kind)
    if (!parsed) {
      throw new Error('The AI returned items that could not be read. Please try again.')
    }
    items.push({
      prompt: parsed.prompt,
      answer: parsed.answer,
      explanation: parsed.explanation,
      metadata: {
        provider: providerId,
        model,
        promptVersion: PROMPT_VERSION,
        ...(parsed.options ? { options: parsed.options } : {}),
      },
    })
  }

  if (items.length !== expectedLength) {
    throw new Error(`The AI generated ${items.length} of the ${expectedLength} items requested. Please try again.`)
  }
  return items
}

function parseItem(raw: unknown, kind: GeneratedSetKind): { prompt: string; answer: string; explanation: string | null; options?: string[] } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as Record<string, unknown>

  const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
  const answer = typeof item.answer === 'string' ? item.answer.trim() : ''
  if (!prompt || !answer) return null

  const explanation = typeof item.explanation === 'string' && item.explanation.trim() ? item.explanation.trim() : null

  if (kind === 'QUIZ') {
    const options = Array.isArray(item.options)
      ? item.options.map((option) => (typeof option === 'string' ? option.trim() : '')).filter(Boolean)
      : []
    if (options.length !== 4 || !options.includes(answer)) return null
    return { prompt, answer, explanation, options }
  }

  return { prompt, answer, explanation }
}