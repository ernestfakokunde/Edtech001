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