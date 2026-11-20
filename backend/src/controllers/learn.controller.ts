import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { AiNotConfiguredError, chatWithStudyMaterialStream, GenerationFailedError, type StudyChatMessage } from '../services/ai.service.js'
import { extractText } from '../utils/extractText.js'
import { assertDocumentSignature, fileExtension } from '../utils/file.js'
import { AiCreditsExhaustedError, completeAiCredit, getAiCreditQuota, refundAiCredit, reserveAiCredit } from '../services/aiCredits.service.js'
import { recordMissionAction } from '../services/missions.service.js'
import { prisma } from '../lib/prisma.js'

const MAX_DOCUMENT_TEXT = 60_000
const FREE_CHAT_HISTORY_MESSAGES = 5
const PAID_CHAT_HISTORY_MESSAGES = 20
const FREE_CHAT_RETENTION = 5
const PAID_CHAT_RETENTION = 50

function chatHistoryLimit(profile: { subscriptionPlan: string; tier: 'FREE' | 'PREMIUM'; premiumUntil: Date | null }) {
  const hasActivePlan = profile.premiumUntil !== null
    && profile.premiumUntil > new Date()
    && (profile.subscriptionPlan !== 'FREE' || profile.tier === 'PREMIUM')
  return hasActivePlan ? PAID_CHAT_HISTORY_MESSAGES : FREE_CHAT_HISTORY_MESSAGES
}

function activePaidPlan(profile: { subscriptionPlan: string; tier: 'FREE' | 'PREMIUM'; premiumUntil: Date | null }) {
  return chatHistoryLimit(profile) === PAID_CHAT_HISTORY_MESSAGES
}

async function trimLearnChats(profile: { id: string; subscriptionPlan: string; tier: 'FREE' | 'PREMIUM'; premiumUntil: Date | null }) {
  const retentionLimit = activePaidPlan(profile) ? PAID_CHAT_RETENTION : FREE_CHAT_RETENTION
  const oldChats = await prisma.learnChat.findMany({ where: { profileId: profile.id }, orderBy: { updatedAt: 'desc' }, skip: retentionLimit, select: { id: true } })
  if (oldChats.length) await prisma.learnChat.deleteMany({ where: { id: { in: oldChats.map((item) => item.id) }, profileId: profile.id } })
}

function readStoredMessages(value: unknown): StudyChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as { role?: unknown; content?: unknown }
    return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
      ? [{ role: item.role as StudyChatMessage['role'], content: item.content.slice(0, 8000) }]
      : []
  }).slice(-100)
}

export async function listLearnChats(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  await trimLearnChats(profile)
  const chats = await prisma.learnChat.findMany({
    where: { profileId: profile.id },
    orderBy: { updatedAt: 'desc' },
    take: activePaidPlan(profile) ? PAID_CHAT_RETENTION : FREE_CHAT_RETENTION,
    select: { id: true, title: true, updatedAt: true, messages: true },
  })
  response.json({ chats: chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    preview: readStoredMessages(chat.messages).at(-1)?.content.slice(0, 100) ?? '',
  })) })
}

export async function getLearnChat(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  await trimLearnChats(profile)
  const id = typeof request.params.id === 'string' ? request.params.id : ''
  const chat = await prisma.learnChat.findFirst({ where: { id, profileId: profile.id } })
  if (!chat) { response.status(404).json({ message: 'That chat could not be found.' }); return }
  response.json({ chat: {
    id: chat.id, title: chat.title, topic: chat.topic, documentName: chat.documentName,
    documentText: chat.documentText, messages: readStoredMessages(chat.messages), updatedAt: chat.updatedAt,
  } })
}

function uploadFile(request: Request) {
  return (request as AuthenticatedRequest & { file?: Express.Multer.File }).file
}

export async function readLearnDocument(request: Request, response: Response) {
  const file = uploadFile(request)
  if (!file) { response.status(400).json({ message: 'Choose a PDF to start a study session.' }); return }
  if (fileExtension(file) !== 'pdf') { response.status(415).json({ message: 'Learn with AI currently supports PDF files.' }); return }
  assertDocumentSignature(file)
  let text: string
  try { text = await extractText(file, 'pdf') }
  catch { response.status(422).json({ message: 'We could not read this PDF. Try another file.' }); return }
  if (text.trim().length < 80) {
    response.status(422).json({ message: 'This PDF does not contain enough selectable text yet. Scanned PDFs are not supported in Learn with AI.' })
    return
  }
  const { profile } = request as AuthenticatedRequest
  response.json({ title: file.originalname, documentText: text.slice(0, MAX_DOCUMENT_TEXT), truncated: text.length > MAX_DOCUMENT_TEXT, studentName: profile.displayName })
}

export async function askLearnTutor(request: Request, response: Response) {
  const { profile } = request as AuthenticatedRequest
  const body = request.body && typeof request.body === 'object'
    ? request.body as { documentText?: unknown; documentName?: unknown; topic?: unknown; question?: unknown; history?: unknown; chatId?: unknown }
    : {}
  const requestedChatId = typeof body.chatId === 'string' ? body.chatId : undefined
  const savedChat = requestedChatId
    ? await prisma.learnChat.findFirst({ where: { id: requestedChatId, profileId: profile.id } })
    : null
  if (requestedChatId && !savedChat) { response.status(404).json({ message: 'That chat could not be found. Start a new chat.' }); return }
  const text = savedChat?.documentText ?? (typeof body.documentText === 'string' ? body.documentText.trim() : '')
  const topic = savedChat?.topic ?? (typeof body.topic === 'string' ? body.topic.trim() : '')
  const documentName = savedChat?.documentName ?? (typeof body.documentName === 'string' ? body.documentName.trim().slice(0, 255) : '')
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (text.length > MAX_DOCUMENT_TEXT || (text.length > 0 && text.length < 80) || (!text && (topic.length < 2 || topic.length > 200))) {
    response.status(400).json({ message: 'Start with a readable PDF or enter a topic of up to 200 characters.' }); return
  }
  if (!question || question.length > 2000) { response.status(400).json({ message: 'Ask a question up to 2,000 characters long.' }); return }
  const rawHistory = savedChat ? readStoredMessages(savedChat.messages) : Array.isArray(body.history) ? body.history : []
  const historyLimit = chatHistoryLimit(profile)
  if (!savedChat && rawHistory.length > PAID_CHAT_HISTORY_MESSAGES) { response.status(400).json({ message: 'Start a fresh chat to continue studying.' }); return }
  const history: StudyChatMessage[] = []
  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') { response.status(400).json({ message: 'The conversation could not be read.' }); return }
    const message = item as { role?: unknown; content?: unknown }
    if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string' || message.content.length > 2000) {
      response.status(400).json({ message: 'The conversation could not be read.' }); return
    }
    history.push({ role: message.role, content: message.content.slice(0, 8000) })
  }
  const creditRequestId = randomUUID()
  let creditReservation: { id: string } | undefined
  let streamStarted = false
  try {
    creditReservation = await reserveAiCredit(profile.id, 'LEARN', creditRequestId)
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    let fullAnswer = ''
    for await (const chunk of chatWithStudyMaterialStream({ text: text || undefined, topic: topic || undefined, question, history: history.slice(-historyLimit) })) {
      streamStarted = true
      response.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
      fullAnswer += chunk
    }
    const messages = [...history, { role: 'user' as const, content: question }, { role: 'assistant' as const, content: fullAnswer }].slice(-100)
    const chat = savedChat
      ? await prisma.learnChat.update({ where: { id: savedChat.id }, data: { messages, title: savedChat.title } })
      : await prisma.learnChat.create({ data: {
        profileId: profile.id,
        title: (topic || documentName || question).slice(0, 120),
        topic: topic || null,
        documentName: documentName || null,
        documentText: text || null,
        messages,
      } })
    await trimLearnChats(profile)
    response.write(`data: ${JSON.stringify({ chatId: chat.id, quota: await getAiCreditQuota(profile.id) })}\n\n`)
    response.write('data: [DONE]\n\n')
    response.end()
    await completeAiCredit(creditReservation.id)
    try { await recordMissionAction(profile.id, 'LEARN_MESSAGE_SENT') }
    catch (reason) { console.error('[missions] Could not record completed tutor message:', reason) }
  } catch (reason) {
    if (creditReservation) await refundAiCredit(creditReservation.id)
    if (response.headersSent && streamStarted) {
      const message = reason instanceof GenerationFailedError && reason.code === 'AI_BUSY'
        ? 'Your tutor is busy right now. Please try again shortly.'
        : 'The answer was interrupted. Please try again.'
      response.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      response.end()
      return
    }
    if (reason instanceof AiCreditsExhaustedError) {
      const quota = await getAiCreditQuota(profile.id)
      response.status(429).json({ message: `You have used all ${quota.limit} AI credits for this month. Your credits reset next month.`, quota })
      return
    }
    if (reason instanceof AiNotConfiguredError) { response.status(503).json({ message: 'AI tutoring is temporarily unavailable. Please try again later.', code: 'AI_NOT_CONFIGURED' }); return }
    if (reason instanceof GenerationFailedError) {
      console.error('[learn/chat] AI provider failed:', reason.message)
      response.status(reason.code === 'AI_BUSY' ? 503 : 502).json({ message: reason.code === 'AI_BUSY' ? 'Your tutor is busy right now. Please try again shortly.' : 'We could not get an answer just now. Please try again.', code: reason.code })
      return
    }
    console.error('[learn/chat] Unexpected tutor error:', reason)
    response.status(500).json({ message: 'We could not answer that just now. Please try again.' })
  }
}
