import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// tsx pre-loads dotenv before any script runs, so by the time this module
// loads the real .env (if any) is already in process.env. Calling config()
// again would re-inject the on-disk file OVER values a script stamped first
// (dotenv never overrides), which is exactly how a stale GEMINI_API_KEY /
// GROQ_API_KEY leaked into the offline ai-multiprovider-check. So: only load
// a .env file when nothing was pre-loaded (real `node dist/server.js` boot
// without tsx, where process.env is still empty).
if (!process.env.DOTENV_PRELOADED && !process.env.TSX_VERSION && !process.env.DATABASE_URL) {
  const backendEnvPath = resolve(process.cwd(), 'backend/.env')
  const localEnvPath = resolve(process.cwd(), '.env')
  config({ path: existsSync(backendEnvPath) ? backendEnvPath : localEnvPath })
}

const requiredEnv = ['DATABASE_URL', 'SESSION_SECRET'] as const

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`[config] ${key} is not set; the backend may not start correctly.`)
  }
}

/**
 * AI providers that can power POST /api/generation. Every provider is optional:
 * configure as many API keys as you like. The service layer picks the primary
 * (AI_PROVIDER), falls back through AI_FALLBACK_PROVIDERS when it fails, and
 * lets a client override the selection per request with an explicit
 * `provider` field (see GET /api/generation/providers).
 */
export type AiProviderId = 'anthropic' | 'openai' | 'grok' | 'groq' | 'gemini' | 'custom'

export type AiProviderConfig = {
  /** Human-friendly name shown in the UI / stored next to nothing sensitive. */
  label: string
  /** API key; when set the provider is considered configured and selectable. */
  apiKey?: string
  /** Model identifier sent to the provider's API. Overridable per env var. */
  model: string
  /** Base URL override for providers that speak an OpenAI-compatible API. */
  baseUrl?: string
  /** Sibling models tried when the primary model is overloaded/missing (Gemini). */
  fallbackModels?: string[]
}

const aiProviderIds: AiProviderId[] = ['anthropic', 'openai', 'grok', 'groq', 'gemini', 'custom']

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function knownProvider(value: string | undefined): AiProviderId | undefined {
  const candidate = (value ?? '').trim().toLowerCase()
  return (aiProviderIds as readonly string[]).includes(candidate) ? candidate as AiProviderId : undefined
}

function knownProviderList(value: string | undefined): AiProviderId[] {
  const parsed: AiProviderId[] = []
  for (const entry of commaList(value)) {
    const id = knownProvider(entry)
    if (id) parsed.push(id)
  }
  return parsed
}

/**
 * SameSite policy for the session and CSRF cookies. `lax` (the default) is
 * right whenever the app and this API share a registrable domain — a pair like
 * app.example.com / api.example.com, or a frontend that proxies /api to this
 * service. A frontend on an unrelated site (e.g. *.vercel.app → *.onrender.com)
 * needs `none`, otherwise the browser drops both cookies on cross-site fetches
 * and every sign-in silently fails. `none` requires HTTPS, which Render serves.
 */
function cookieSameSite(value: string | undefined): 'lax' | 'none' | 'strict' {
  const candidate = (value ?? '').trim().toLowerCase()
  return candidate === 'none' || candidate === 'strict' ? candidate : 'lax'
}

const frontendOrigins = commaList(process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: frontendOrigins[0] ?? 'http://localhost:5173',
  /** Every origin CORS accepts; FRONTEND_ORIGIN may hold a comma-separated list. */
  frontendOrigins,
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET ?? 'development-only-change-me',
  cookieSameSite: cookieSameSite(process.env.COOKIE_SAME_SITE),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_BUCKET ?? 'recappedu-papers',
  ai: {
    /** Preferred provider when the client does not request one. */
    provider: knownProvider(process.env.AI_PROVIDER) ?? ('anthropic' as AiProviderId),
    /** Providers tried in order when the primary fails. e.g. "openai,gemini" */
    fallbacks: knownProviderList(process.env.AI_FALLBACK_PROVIDERS),
    providers: {
      anthropic: {
        label: 'Anthropic Claude',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
      } satisfies AiProviderConfig,
      openai: {
        label: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
        baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      } satisfies AiProviderConfig,
      grok: {
        label: 'Grok (xAI)',
        apiKey: process.env.GROK_API_KEY,
        model: process.env.GROK_MODEL ?? 'grok-3',
        baseUrl: process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1',
      } satisfies AiProviderConfig,
      // Groq (https://console.groq.com) — OpenAI-compatible Chat Completions
      // API, so no base URL is needed from you: it defaults to
      // https://api.groq.com/openai/v1. Keys start with `gsk_`.
      groq: {
        label: 'Groq',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        baseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
      } satisfies AiProviderConfig,
      gemini: {
        label: 'Google Gemini',
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
        // When the primary model is rate-limited or overloaded (or the model
        // id does not exist for this key), lighter siblings take over — they
        // usually have spare capacity during demand spikes.
        fallbackModels: commaList(process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-2.5-flash-lite,gemini-2.0-flash'),
      } satisfies AiProviderConfig,
      // OpenAI-compatible endpoint for any other provider (DeepSeek, Mistral,
      // OpenRouter, LM Studio, Ollama, …). Needs both a base URL and API key.
      custom: {
        label: process.env.CUSTOM_OPENAI_PROVIDER_NAME ?? 'Custom provider',
        apiKey: process.env.CUSTOM_OPENAI_API_KEY,
        model: process.env.CUSTOM_OPENAI_MODEL ?? 'gpt-3.5-turbo',
        baseUrl: process.env.CUSTOM_OPENAI_BASE_URL,
      } satisfies AiProviderConfig,
    },
  },
}
