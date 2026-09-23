import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'

const CSRF_COOKIE = 'recappedu_csrf'
const CSRF_HEADER = 'x-csrf-token'

function createToken() {
  return randomBytes(32).toString('base64url')
}

export function issueCsrfToken(_request: Request, response: Response) {
  const token = createToken()
  response.cookie(CSRF_COOKIE, token, { httpOnly: false, sameSite: env.cookieSameSite, secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 })
  response.json({ csrfToken: token })
}

export function requireCsrf(request: Request, response: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { next(); return }
  const cookieToken = request.cookies?.[CSRF_COOKIE] as string | undefined
  const headerToken = request.header(CSRF_HEADER)
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length || !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    response.status(403).json({ message: 'This request could not be verified. Refresh the page and try again.' })
    return
  }
  next()
}