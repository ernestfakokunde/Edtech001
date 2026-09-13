import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import type { SupportedPaperExtension } from './file.js'

/**
 * Extracts raw text from an uploaded file.
 *
 * - .pdf  → pdf-parse (pdfjs-dist based, handles most text-based PDFs).
 * - .docx → mammoth (Open XML .docx only).
 * - .doc  → not supported: mammoth cannot reliably parse the legacy binary
 *           Word format. Converting .doc → .docx/.pdf first is the planned
 *           next step (see the generate-flow handoff spec).
 *
 * @param file        The Multer in-memory uploaded file.
 * @param extension   Validated extension from fileExtension().
 * @returns           The document's plain text.
 */
export async function extractText(file: Express.Multer.File, extension: SupportedPaperExtension): Promise<string> {
  if (extension === 'pdf') return extractPdf(file.buffer)
  if (extension === 'docx') return extractDocx(file.buffer)
  throw new Error('Legacy .doc (binary Word) files are not supported yet. Save the document as .docx or .pdf and upload it again.')
}

async function extractPdf(buffer: Express.Multer.File['buffer']): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

async function extractDocx(buffer: Express.Multer.File['buffer']): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}