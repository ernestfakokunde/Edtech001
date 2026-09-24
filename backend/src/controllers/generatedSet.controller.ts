import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { supabase } from '../lib/supabase.js'
import { env } from '../config/env.js'
import { fileExtension } from '../utils/file.js'
import { extractText } from '../utils/extractText.js'
import { generateStudyItems, AiNotConfiguredError, GenerationFailedError, isAiConfigured, listGenerationProviders, type GeneratedItem } from '../services/ai.service.js'

/**
 * Best-effort cleanup after any post-upload failure: removes the stored file
 * (if any) together with the personal Paper row, so we never leave an orphaned
 * record pointing at a file that feeds an incomplete generation.
 */
async function rollbackPersonalPaper(paperId: string, storedPath?: string) {
  if (storedPath && env.supabaseUrl && env.supabaseServiceRoleKey) {
    try { await supabase.storage.from(env.supabaseBucket).remove([storedPath]) } catch { /* the DB row is the important part */ }
  }
  try { await prisma.paper.delete({ where: { id: paperId } }) } catch { /* row already gone */ }
}

function setTitle(course: { code: string }, kind: 'FLASHCARD' | 'QUIZ') {
  const label = kind === 'QUIZ' ? 'Quiz' : 'Flashcards'
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${course.code} ${label} · ${date}`
}

/**
 * GET /api/generation/providers — which AI providers this server supports and
 * which have credentials configured right now. The UI uses this to show the
 * available provider choices (or a "no provider configured" warning).
 */
export function listGenerationProvidersController(_request: Request, response: Response) {
  response.json({ providers: listGenerationProviders(), primary: env.ai.provider })
}

const FREE_DAILY_QUIZ_LIMIT = 5

function startOfUtcDay() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Daily quota for quiz generations. Free accounts get a fixed number of quiz
 * runs a day; PREMIUM (payment integration comes later) is unlimited. This is
 * deliberately UTC-day based so the count resets predictably.
 */
/** Premium = the paying tier, or an active promo-code window (premiumUntil). */
function effectiveTier(profile: { tier: 'FREE' | 'PREMIUM'; premiumUntil: Date | null }): 'FREE' | 'PREMIUM' {
  if (profile.tier === 'PREMIUM') return 'PREMIUM'
  return profile.premiumUntil && profile.premiumUntil > new Date() ? 'PREMIUM' : 'FREE'
}

export async function generationQuotaController(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  const quota = await getGenerationQuota(profile.id, effectiveTier(profile))
  response.json(quota)
}

export async function getGenerationQuota(userId: string, tier: 'FREE' | 'PREMIUM') {
  const limit = tier === 'PREMIUM' ? null : FREE_DAILY_QUIZ_LIMIT
  const used = tier === 'PREMIUM' ? 0 : await prisma.generatedSet.count({ where: { userId, type: 'QUIZ', createdAt: { gte: startOfUtcDay() } } })
  return {
    tier,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: new Date(startOfUtcDay().getTime() + 86400000).toISOString(),
  }
}

/**
 * POST /api/generation/:setId/attempts — record one finished quiz run so the
 * student can open a past-results history later (any device). The set must
 * belong to the caller and be a QUIZ; score/total are validated integers and
 * percent is derived server-side.
 */
export async function recordQuizAttempt(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  const setId = Array.isArray(request.params.setId) ? request.params.setId[0] : request.params.setId
  const { score, total } = request.body as Partial<{ score: number; total: number }>
  if (!setId) { response.status(400).json({ message: 'A study set id is required.' }); return }
  if (!Number.isInteger(score) || !Number.isInteger(total) || (score ?? 0) < 0 || (total ?? 0) <= 0 || (score as number) > (total as number)) {
    response.status(400).json({ message: 'score and total must be whole numbers with 0 <= score <= total.' })
    return
  }
  const set = await prisma.generatedSet.findFirst({ where: { id: setId, userId: profile.id } })
  if (!set) { response.status(404).json({ message: 'Study set not found.' }); return }
  if (set.type !== 'QUIZ') { response.status(400).json({ message: 'Only quiz sets can have attempts recorded.' }); return }
  const percent = Math.round(((score as number) / (total as number)) * 100)
  const attempt = await prisma.quizAttempt.create({ data: { userId: profile.id, setId, score: score as number, total: total as number, percent } })
  response.status(201).json({ attempt })
}

/**
 * GET /api/generation/attempts — the caller's past quiz results, newest first,
 * with the set title + course code for display. Supports ?page=&pageSize=.
 */
export async function listQuizAttempts(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  const rawPage = typeof request.query.page === 'string' ? Number(request.query.page) : NaN
  const rawSize = typeof request.query.pageSize === 'string' ? Number(request.query.pageSize) : NaN
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1
  const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize, 100) : 20
  const where = { userId: profile.id }
  const [attempts, total] = await Promise.all([
    prisma.quizAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { set: { select: { id: true, title: true, timePerQuestion: true, course: { select: { code: true, title: true } } } } },
    }),
    prisma.quizAttempt.count({ where }),
  ])
  const stats = await prisma.quizAttempt.aggregate({ where, _avg: { percent: true }, _max: { percent: true }, _count: { id: true } })
  response.json({
    attempts,
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    stats: {
      attempts: stats._count.id,
      average: stats._avg.percent == null ? 0 : Math.round(stats._avg.percent),
      best: stats._max.percent ?? 0,
    },
  })
}

/**
 * DELETE /api/generation/attempts/:attemptId — remove one past result.
 * DELETE /api/generation/attempts — clear the whole history.
 */
export async function deleteQuizAttempt(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  const attemptId = Array.isArray(request.params.attemptId) ? request.params.attemptId[0] : request.params.attemptId
  const existing = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId: profile.id }, select: { id: true } })
  if (!existing) { response.status(404).json({ message: 'That result was not found.' }); return }
  await prisma.quizAttempt.delete({ where: { id: existing.id } })
  response.status(204).send()
}

export async function clearQuizAttempts(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  await prisma.quizAttempt.deleteMany({ where: { userId: profile.id } })
  response.status(204).send()
}

export async function generateStudySet(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  const file = (request as AuthenticatedRequest & { file?: Express.Multer.File }).file

  if (!file) {
    response.status(400).json({ message: 'No file uploaded. A file is required.' })
    return
  }

  const { courseId, type, length, timePerQuestion, provider } = request.body as Partial<{
    courseId: string
    type: 'FLASHCARD' | 'QUIZ'
    length: string
    timePerQuestion: string
    provider: string
  }>

  if (!courseId || (type !== 'FLASHCARD' && type !== 'QUIZ') || !length) {
    response.status(400).json({ message: 'courseId, type, and length are required.' })
    return
  }

  // A client may pick which configured provider to use; validate the value at
  // runtime rather than trusting a compile-time union.
  if (provider !== undefined && (typeof provider !== 'string' || provider.trim() === '')) {
    response.status(400).json({ message: 'provider must be a non-empty string when given.' })
    return
  }

  const parsedLength = Number(length)
  const parsedTimePerQuestion = timePerQuestion ? Number(timePerQuestion) : undefined

  if (!Number.isInteger(parsedLength) || parsedLength <= 0) {
    response.status(400).json({ message: 'length must be a positive whole number.' })
    return
  }

  if (type === 'QUIZ' && (!parsedTimePerQuestion || ![30, 60].includes(parsedTimePerQuestion))) {
    response.status(400).json({ message: 'timePerQuestion is required for QUIZ type and must be 30 or 60.' })
    return
  }

  // Daily free quota for quizzes: FREE accounts get a set number per day,
  // PREMIUM accounts (payments arrive later) are unlimited.
  if (type === 'QUIZ' && effectiveTier(profile) !== 'PREMIUM') {
    const quota = await getGenerationQuota(profile.id, effectiveTier(profile))
    if (quota.remaining === 0) {
      response.status(429).json({ message: `You have used all ${quota.limit} free quiz generations for today. Come back tomorrow or upgrade to PREMIUM for unlimited quizzes.`, quota })
      return
    }
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) {
    response.status(404).json({ message: 'Course not found.' })
    return
  }

  const paper = await prisma.paper.create({
    data: {
      ownerId: profile.id,
      courseId: course.id,
      fileUrl: '',
      isPersonal: true,
    },
  })

  const extension = fileExtension(file)
  if (!extension) {
    await rollbackPersonalPaper(paper.id)
    response.status(400).json({ message: 'Only PDF, DOC, or DOCX files are supported.' })
    return
  }

  const path = `personal/${profile.id}/${paper.id}.${extension}`

  const { error } = await supabase.storage.from(env.supabaseBucket).upload(path, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  })

  if (error) {
    console.warn(`[generate] archive upload failed, continuing without archive: ${error.message}`)
  } else {
    await prisma.paper.update({ where: { id: paper.id }, data: { fileUrl: path } })
  }

  // 10–11. Extract text from the file (pdf-parse for .pdf, mammoth for .docx).
  let text: string
  try {
    text = await extractText(file, extension)
  } catch (reason) {
    console.error('[generate] text extraction failed:', reason)
    await rollbackPersonalPaper(paper.id, path)
    response.status(422).json({ message: reason instanceof Error ? reason.message : 'Could not read text from this file. Please try another format.' })
    return
  }

  if (text.trim().length < 80) {
    await rollbackPersonalPaper(paper.id, path)
    response.status(422).json({ message: 'No readable text was found in this file. Scanned documents and image-only PDFs cannot be processed yet.' })
    return
  }

  if (!isAiConfigured()) {
    console.warn('[generate] no AI provider API key is set; generation is unavailable.')
    await rollbackPersonalPaper(paper.id, path)
    response.status(503).json({ message: 'The AI service is not configured on this server. Please try again later.' })
    return
  }

  // 12–13. Send the extracted text to the AI, then parse and strictly validate
  // its JSON response before writing anything to the database. A client may
  // request a specific provider; the service falls back through the configured
  // chain when it fails.
  let generated: GeneratedItem[]
  try {
    generated = await generateStudyItems({ text, kind: type, length: parsedLength }, { provider: provider ?? null })
  } catch (reason) {
    console.error('[generate] AI generation failed:', reason)
    await rollbackPersonalPaper(paper.id, path)
    if (reason instanceof AiNotConfiguredError) {
      response.status(503).json({ code: 'AI_NOT_CONFIGURED', message: 'The study generator is not set up yet. Please try again later.' })
    } else if (reason instanceof GenerationFailedError && reason.code === 'AI_BAD_KEY') {
      response.status(502).json({ code: 'AI_BAD_KEY', message: 'The study generator is unavailable right now. Please try again later.' })
    } else if (reason instanceof GenerationFailedError && reason.code === 'AI_BUSY') {
      response.status(502).json({ code: 'AI_BUSY', message: 'The study generator is busy right now. Please try again in a moment.' })
    } else {
      response.status(502).json({ code: 'AI_FAILED', message: 'We could not create your study set. Please try again.' })
    }
    return
  }

  // 14–16. Persist the set in a single transaction: one Question row per item
  // (linked to the personal Paper), plus the GeneratedSet and its items with
  // sequential positions (0, 1, 2, …) matching the @@unique([setId, position])
  // constraint.
  try {
    const set = await prisma.generatedSet.create({
      data: {
        userId: profile.id,
        courseId: course.id,
        type,
        title: setTitle(course, type),
        requestedLength: parsedLength,
        ...(parsedTimePerQuestion ? { timePerQuestion: parsedTimePerQuestion } : {}),
        items: {
          create: generated.map((item, position) => ({
            position,
            question: {
              create: {
                paperId: paper.id,
                prompt: item.prompt,
                answer: item.answer,
                explanation: item.explanation,
                metadata: item.metadata,
              },
            },
          })),
        },
      },
      include: {
        items: { orderBy: { position: 'asc' }, include: { question: true } },
      },
    })
    response.status(201).json({ set })
  } catch (reason) {
    console.error('[generate] saving the generated set failed:', reason)
    await rollbackPersonalPaper(paper.id, path)
    response.status(500).json({ message: 'The study set could not be saved. Please try again.' })
  }
}