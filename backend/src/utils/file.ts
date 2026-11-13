export const SUPPORTED_PAPER_EXTENSIONS = ['pdf', 'doc', 'docx'] as const

export type SupportedPaperExtension = (typeof SUPPORTED_PAPER_EXTENSIONS)[number]

/**
 * Derives the file extension from Multer's original filename and only allows
 * the types the repository and generation flows accept. Returns null so the
 * caller can reject unsupported files with a 400.
 */
export function fileExtension(file: Express.Multer.File): SupportedPaperExtension | null {
  const extension = file.originalname.toLowerCase().split('.').pop() ?? ''
  return (SUPPORTED_PAPER_EXTENSIONS as readonly string[]).includes(extension)
    ? extension as SupportedPaperExtension
    : null
}

/** Raised when the bytes on disk are not the document the filename claims. */
export class FileSignatureMismatchError extends Error {
  readonly status = 415
  readonly code = 'FILE_SIGNATURE_MISMATCH'
  constructor() {
    super('That file’s contents do not match its extension. Upload a real PDF or Word document.')
    this.name = 'FileSignatureMismatchError'
  }
}

const PDF_MAGIC = Buffer.from('%PDF-')
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

/**
 * Sniffs the actual container instead of trusting the browser-supplied MIME
 * type or filename. A `.pdf` must carry the PDF header, `.docx` must be a ZIP
 * container, and `.doc` must be the legacy OLE compound file.
 */
export function assertDocumentSignature(file: Express.Multer.File): SupportedPaperExtension | null {
  const extension = fileExtension(file)
  if (!extension) return null

  const buffer = file.buffer
  const isPdf = buffer.subarray(0, 1024).includes(PDF_MAGIC)
  const isZip = buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_MAGIC)
  const isOle = buffer.length >= 8 && buffer.subarray(0, 8).equals(OLE_MAGIC)

  const matches = extension === 'pdf'
    ? isPdf
    : extension === 'docx'
      ? isZip
      : isOle

  if (!matches) throw new FileSignatureMismatchError()
  return extension
}