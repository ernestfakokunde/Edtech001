// Temporary offline verification of the multi-provider AI service.
// tsx pre-loads dotenv BEFORE this file runs, so the real .env on disk is
// already injected by the time these assignments execute (process.env wins
// because these lines run after that preload). Do NOT add any dotenv
// import/config() call here: dotenv never overrides, so re-loading would
// re-inject the stale on-disk GEMINI_API_KEY/GROQ_API_KEY over the test keys.
process.env.AI_PROVIDER = "openai"
process.env.AI_FALLBACK_PROVIDERS = "grok,gemini"
process.env.ANTHROPIC_API_KEY = "ak-test"
process.env.OPENAI_API_KEY = "ok-test"
process.env.GROK_API_KEY = "gk-test"
process.env.GROQ_API_KEY = "gsk-test"
process.env.GEMINI_API_KEY = "AIza-test"
process.env.CUSTOM_OPENAI_API_KEY = "ck-test"
process.env.CUSTOM_OPENAI_BASE_URL = "http://localhost:9999/v1"
process.env.CUSTOM_OPENAI_PROVIDER_NAME = "Test Custom"

const { generateStudyItems, isAiConfigured, listGenerationProviders, AiNotConfiguredError } = await import("../services/ai.service.js")

const QUIZ_ITEMS = [
  { prompt: "Q1?", answer: "A", explanation: "why A", options: ["A", "B", "C", "D"] },
  { prompt: "Q2?", answer: "C", explanation: "why C", options: ["A", "B", "C", "D"] },
]
const CARD_ITEMS = [
  { prompt: "F1?", answer: "ans1", explanation: "note" },
  { prompt: "F2?", answer: "ans2", explanation: "note" },
  { prompt: "F3?", answer: "ans3", explanation: null },
]
const CARD_ONE = CARD_ITEMS.slice(0, 1)

const results: string[] = []
let pass = true
function check(name: string, ok: boolean, extra = "") {
  pass = pass && ok
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`)
}

// fetch stub routed by host; behaviour switched via `mode` per test step.
let mode: "openai-ok" | "openai-retry" | "openai-down" | "grok-ok" | "grok-bad" | "groq-ok" | "all-down" | "custom-ok" | "gemini-fallback" | "gemini-all-overloaded" = "openai-ok"
let openaiCalls = 0
let geminiCalls = 0
const respond = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } })
const choicesJson = (items: unknown) => respond({ choices: [{ message: { content: JSON.stringify(items) } }] })
globalThis.fetch = async (url) => {
  const target = String(url)
  if (target.includes("api.openai.com")) {
    if (mode === "openai-ok") return choicesJson(QUIZ_ITEMS)
    if (mode === "openai-retry") {
      openaiCalls += 1
      // Two transient 503 overloads (postJson retries them), then a real answer.
      return openaiCalls <= 2 ? respond({ error: { message: "model overloaded" } }, 503) : choicesJson(QUIZ_ITEMS)
    }
    if (mode === "all-down") return respond({ error: { message: "invalid_api_key" } }, 401)
    return respond({ error: { message: "rate_limited" } }, 429)
  }
  if (target.includes("api.x.ai")) {
    if (mode === "grok-ok" || mode === "openai-down") return choicesJson(CARD_ITEMS)
    if (mode === "grok-bad") return choicesJson([{ prompt: "only prompt, no answer" }])
    return respond({ error: { message: "engine_overloaded" } }, 503)
  }
  if (target.includes("generativelanguage.googleapis.com")) {
    if (mode === "gemini-fallback") {
      // Primary model overloaded (one fast attempt, no backoff retries), then
      // a lighter sibling from GEMINI_FALLBACK_MODELS answers.
      return target.includes("/models/gemini-2.5-flash:")
        ? respond({ error: { message: "high demand" } }, 503)
        : respond({ candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(CARD_ONE) + "\n```" }] } }] })
    }
    // First two models in the chain overload (one fast attempt each); the
    // third sibling answers. Proves the cascade walks the whole list.
    if (mode === "gemini-all-overloaded") {
      geminiCalls += 1
      return geminiCalls <= 2
        ? respond({ error: { message: "high demand" } }, 503)
        : respond({ candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(CARD_ONE) + "\n```" }] } }] })
    }
    if (mode === "all-down") return respond({ error: { message: "permission_denied" } }, 403)
    // Real Gemini models often wrap the JSON in a ```json fence and add prose
    // after the closing fence; the service must still extract the array.
    return respond({ candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(CARD_ONE) + "\n```\nHere are your flashcards!" }] } }] })
  }
  if (target.includes("api.groq.com")) {
    if (mode === "all-down") return respond({ error: { message: "invalid_api_key" } }, 401)
    if (mode === "groq-ok") return choicesJson(CARD_ONE)
    return respond({ error: { message: "engine_overloaded" } }, 503)
  }
  if (target.includes("localhost:9999")) {
    if (mode === "custom-ok") return choicesJson(CARD_ONE)
    return respond({ error: { message: "not_found" } }, 404)
  }
  return respond({ error: { message: `unexpected host ${target}` } }, 500)
}

const TEXT = "A reasonably long document about cyber security with enough content to study from."

// 1. Listing + config detection
const providers = listGenerationProviders()
check("listing returns all 6 providers", providers.length === 6, providers.map((p) => `${p.id}:${p.configured}`).join(" "))
check("all providers marked configured", providers.every((p) => p.configured))
check("isAiConfigured() === true", isAiConfigured() === true)

// 2. Primary (openai) serves the request; quiz validation + metadata
mode = "openai-ok"
const quiz = await generateStudyItems({ text: TEXT, kind: "QUIZ", length: 2 })
check("primary openai yields 2 quiz items", quiz.length === 2)
check("metadata records provider/model/version", quiz.every((i) => i.metadata.provider === "openai" && i.metadata.model === "gpt-4o" && i.metadata.promptVersion === "2"))
check("quiz options persisted", quiz.every((i) => i.metadata.options?.length === 4))

// 3. Failover on HTTP error: openai 429 → grok
mode = "openai-down"
const cards = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 3 })
check("failover to grok after HTTP failure", cards.length === 3 && cards.every((i) => i.metadata.provider === "grok"))

// 4. Failover on validation error: grok wrong count → gemini (fenced payload)
mode = "grok-bad"
const single = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 1 })
check("failover to gemini after validation failure", single.length === 1 && single.every((i) => i.metadata.provider === "gemini"))
check("fenced ```json gemini payload with trailing prose is extracted", single.length === 1 && single[0]?.prompt === "F1?" && single[0]?.answer === "ans1")

// 5. Client-requested provider override (generic OpenAI-compatible endpoint)
mode = "custom-ok"
const custom = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 1 }, { provider: "custom" })
check("client can request the custom provider", custom.length === 1 && custom.every((i) => i.metadata.provider === "custom"))

// 5a. Client-requested Groq (native provider, `gsk_` key, no base URL needed)
mode = "groq-ok"
const groqOnly = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 1 }, { provider: "groq" })
check("client can request the groq provider", groqOnly.length === 1 && groqOnly.every((i) => i.metadata.provider === "groq" && i.metadata.model === "llama-3.3-70b-versatile"))

// 5b. Transient upstream failures (Google "high demand"-style 503 overloads)
// are retried with backoff instead of failing the request outright.
mode = "openai-retry"
openaiCalls = 0
const retried = await generateStudyItems({ text: TEXT, kind: "QUIZ", length: 2 })
check("transient 503s are retried and the provider recovers", retried.length === 2 && retried.every((i) => i.metadata.provider === "openai") && openaiCalls === 3, `calls=${openaiCalls}`)

// 5c. When the primary Gemini model is overloaded, a lighter sibling from
// GEMINI_FALLBACK_MODELS answers instead (metadata records the sibling).
mode = "gemini-fallback"
const geminiFallback = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 1 })
check("gemini model overload cascades to a sibling model", geminiFallback.length === 1 && geminiFallback.every((i) => i.metadata.model === "gemini-2.5-flash-lite"), `model=${geminiFallback[0]?.metadata.model}`)

// 5d. When the first two models in the chain overload, the cascade keeps
// walking: the third sibling answers (metadata records it, 3 attempts).
mode = "gemini-all-overloaded"
geminiCalls = 0
const geminiThird = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 1 })
check("gemini cascade walks the whole model chain", geminiThird.length === 1 && geminiThird.every((i) => i.metadata.model === "gemini-2.0-flash") && geminiCalls === 3, `model=${geminiThird[0]?.metadata.model} calls=${geminiCalls}`)

// 6. All providers down → clear aggregate error naming the provider
mode = "all-down"
const allDown = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 3 }).then(() => null).catch((error) => error)
check("all providers failing throws aggregate error", allDown instanceof Error && allDown.message.includes("No AI provider"))
check("aggregate error names a provider", typeof allDown?.message === "string" && allDown.message.includes("Grok (xAI)"))

// 7. Requesting a provider that is not configured → AiNotConfiguredError
const missing = await generateStudyItems({ text: TEXT, kind: "FLASHCARD", length: 1 }, { provider: "deepseek" }).then(() => null).catch((error) => error)
check("unknown requested provider raises AiNotConfiguredError", missing instanceof AiNotConfiguredError && missing.message.includes('"deepseek"'))

console.log(results.join("\n"))
if (!pass) process.exit(1)
console.log(`\nAll ${results.length} checks passed.`)