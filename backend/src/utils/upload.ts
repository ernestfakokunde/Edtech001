import multer from 'multer'
import { fileExtension } from './file.js'

/**
 * The document-upload contract shared by every route that accepts a file
 * (POST /api/papers and POST /api/generation): the 10 MB body cap, the
 * extension allow-list and the error mapping for both.
 *
 * The mapping is the important half. Multer stops reading the request the
 * instant the cap is hit, so an oversize upload used to fall through to the
 * generic 500 handler — which tells the client nothing, and on a slow mobile
 * connection the browser often reports the torn-down transfer as
 * `TypeError: Failed to fetch` / `Load failed` instead of any HTTP status at
 * all. Answering 413/415 with a readable message lets the UI explain the real
 * problem (see the error middleware in server.ts).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '10 MB'

/** Raised by the file filter for a file this API cannot extract text from. */
export class UnsupportedFileTypeError extends Error {
  readonly status = 415
  readonly code = 'UNSUPPORTED_FILE_TYPE'
  constructor(fileName: string) {
    super(`"${fileName}" is not a supported document. Upload a PDF, DOC or DOCX file.`)
    this.name = 'UnsupportedFileTypeError'
  }
}

/** The multer instance every document upload route mounts. */
export function createDocumentUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_request, file, callback) => {
      // Reject with a message instead of `callback(null, false)`: a silently
      // skipped file arrives at the controller as "No file uploaded", which
      // reads as if the user never picked one.
      if (!fileExtension(file)) {
        callback(new UnsupportedFileTypeError(file.originalname))
        return
      }
      callback(null, true)
    },
  })
}

/**
 * Translates an upload failure into the status + message the client should see.
 * Returns null for anything that is not an upload failure, so the caller can
 * fall back to its generic handler.
 */
export function describeUploadError(error: unknown): { status: number; code: string; message: string } | null {
  if (error instanceof UnsupportedFileTypeError) {
    return { status: error.status, code: error.code, message: error.message }
  }
  if (!(error instanceof multer.MulterError)) return null
  if (error.code === 'LIMIT_FILE_SIZE') {
    return {
      status: 413,
      code: error.code,
      message: `That file is larger than ${MAX_UPLOAD_LABEL}. Compress it or upload a smaller version and try again.`,
    }
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return { status: 400, code: error.code, message: 'Send one document in the "file" field.' }
  }
  return { status: 400, code: error.code, message: 'That upload could not be read. Attach a PDF, DOC or DOCX file and try again.' }
}
