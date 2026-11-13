import type { NextFunction, Request, Response } from 'express'

/**
 * Helmet-style hardening without another dependency. This service only serves
 * JSON and signed downloads, so there is no page of its own to protect with a
 * CSP; the headers below stop MIME sniffing, framing, referrer leakage and
 * unnecessary browser capabilities. HSTS is production-only because local
 * development runs over HTTP.
 */
export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
  next()
}
