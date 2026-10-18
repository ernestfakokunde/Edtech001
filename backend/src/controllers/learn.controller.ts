import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { AiNotConfiguredError, chatWithStudyMaterial, GenerationFailedError, type StudyChatMessage } from '../services/ai.service.js'
import { extractText } from '../utils/extractText.js'
import { fileExtension } from '../utils/file.js'

const MAX_DOCUMENT_TEXT = 60_000

function uploadFile(request: Request) {
  return (request as AuthenticatedRequest & { file?: Express.Multer.File }).file
}

export async function readLearnDocument(request: Request, response: Response) {
  const file = uploadFile(request)
  if (!file) { response.status(400).json({ message: 'Choose a PDF to start a study session.' }); return }
  if (fileExtension(file) !== 'pdf') { response.status(415).json({ message: 'Learn with AI currently supports PDF files.' }); return }
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
  const body = request.body && typeof request.body === 'object'
    ? request.body as { documentText?: unknown; topic?: unknown; question?: unknown; history?: unknown }
    : {}
  const text = typeof body.documentText === 'string' ? body.documentText.trim() : ''
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (text.length > MAX_DOCUMENT_TEXT || (text.length > 0 && text.length < 80) || (!text && (topic.length < 2 || topic.length > 200))) {
    response.status(400).json({ message: 'Start with a readable PDF or enter a topic of up to 200 characters.' }); return
  }
  if (!question || question.length > 2000) { response.status(400).json({ message: 'Ask a question up to 2,000 characters long.' }); return }
  const rawHistory = Array.isArray(body.history) ? body.history : []
  if (rawHistory.length > 8) { response.status(400).json({ message: 'Start a fresh chat to continue studying.' }); return }
  const history: StudyChatMessage[] = []
  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') { response.status(400).json({ message: 'The conversation could not be read.' }); return }
    const message = item as { role?: unknown; content?: unknown }
    if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string' || message.content.length > 2000) {
      response.status(400).json({ message: 'The conversation could not be read.' }); return
    }
    history.push({ role: message.role, content: message.content })
  }
  try {
    const answer = await chatWithStudyMaterial({ text: text || undefined, topic: topic || undefined, question, history })
    response.json({ answer })
  } catch (reason) {
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
