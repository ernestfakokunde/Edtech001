// Regression guard for the upload error contract. An oversize or unsupported
// file has to reach the client as 413/415 with a readable message; when it fell
// through to the generic 500 a phone reported a bare "Failed to fetch" with no
// hint that the file was the problem (see utils/upload.ts).
//
// Re-run with: npx tsx src/scripts/upload-error-check.ts
// Mounts the real multer factory and the real error middleware from
// server.ts, so a change to either is caught here.
import express, { type Request } from 'express'
import { apiErrorHandler } from '../middleware/errorHandler.js'
import { createDocumentUpload, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '../utils/upload.js'

const results: string[] = []
let pass = true
function check(name: string, ok: boolean, extra = '') {
  pass = pass && ok
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const app = express()
app.post('/api/generation', createDocumentUpload().single('file'), (request, response) => {
  const file = (request as Request & { file?: Express.Multer.File }).file
  response.json({ gotFile: Boolean(file), size: file?.size ?? 0 })
})
// Proves the generic 500 path still exists and still leaks nothing.
app.get('/boom', () => { throw new Error('internal detail that must not leak') })
app.use(apiErrorHandler)

const server = app.listen(0)
await new Promise<void>((resolve) => server.once('listening', () => resolve()))
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 0
const base = `http://127.0.0.1:${port}`

async function postFile(bytes: number, name: string) {
  const form = new FormData()
  form.append('file', new Blob([Buffer.alloc(bytes, 65)]), name)
  const response = await fetch(`${base}/api/generation`, { method: 'POST', body: form })
  const body = await response.json().catch(() => null) as { message?: string; code?: string } | null
  return { status: response.status, message: body?.message ?? '', code: body?.code ?? '' }
}

// 1. A file inside the limit still uploads.
const small = await postFile(64 * 1024, 'small.pdf')
check('valid PDF inside the limit is accepted', small.status === 200, `status=${small.status}`)

// 2. One byte over the cap → 413 that names the limit, not a 500.
const tooBig = await postFile(MAX_UPLOAD_BYTES + 1, 'big.pdf')
check('oversize PDF is rejected with 413', tooBig.status === 413, `status=${tooBig.status}`)
check('413 code is LIMIT_FILE_SIZE', tooBig.code === 'LIMIT_FILE_SIZE', `code=${tooBig.code}`)
check('413 message names the limit', tooBig.message.includes(MAX_UPLOAD_LABEL), tooBig.message)

// 3. Wrong extension → 415 naming the file, not a silent skip.
const wrongType = await postFile(64 * 1024, 'photo.jpg')
check('unsupported type is rejected with 415', wrongType.status === 415, `status=${wrongType.status}`)
check('415 code is UNSUPPORTED_FILE_TYPE', wrongType.code === 'UNSUPPORTED_FILE_TYPE', `code=${wrongType.code}`)
check('415 message names the file', wrongType.message.includes('photo.jpg'), wrongType.message)

// 4. Non-upload errors keep the generic 500 and stay opaque.
const boom = await fetch(`${base}/boom`).then(async (response) => ({ status: response.status, message: await response.text() }))
check('non-upload error stays a generic 500', boom.status === 500, `status=${boom.status}`)
check('500 body does not leak internals', !boom.message.includes('internal detail'), boom.message)

server.close()
console.log(results.join('\n'))
if (!pass) process.exit(1)
console.log(`\nAll ${results.length} checks passed.`)
