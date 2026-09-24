import type { NextFunction, Request, Response } from 'express'
import { describeUploadError } from '../utils/upload.js'

/**
 * The API's single error middleware.
 *
 * Upload failures get their real status and a fixable message. Multer stops
 * reading the body the moment the 10 MB cap is hit, so the device is still
 * sending when this reply goes out; answering 413 is what lets the UI say "that
 * file is too large" instead of showing the browser's opaque transfer failure.
 * Everything else stays a generic 500 so no internal error text escapes.
 *
 * Shared with scripts/upload-error-check.ts, which asserts this exact
 * behaviour — see docs/deploy-render.md §8.
 */
export function apiErrorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  const uploadError = describeUploadError(error)
  if (uploadError) {
    console.warn(`[upload-error] ${uploadError.code} (${uploadError.status})`)
    response.status(uploadError.status).json({ message: uploadError.message, code: uploadError.code })
    return
  }
  console.error('[request-error]', error)
  response.status(500).json({ message: 'The server could not process the request.' })
}
