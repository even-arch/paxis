// Shared LLM infrastructure for PAXIS AI endpoints
// PDF Vision support: converts PDF pages to images via mupdf (WASM, no native deps)

export async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: unknown }[],
  maxTokens = 4096,
): Promise<string> {
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? `OpenAI error ${res.status}`)
    }
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }

  if (provider === 'anthropic') {
    const system = (messages.find(m => m.role === 'system')?.content as string | undefined)
    const userMessages = messages.filter(m => m.role !== 'system')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: userMessages,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? `Anthropic error ${res.status}`)
    }
    const data = await res.json() as { content: { text: string }[] }
    return data.content?.[0]?.text ?? ''
  }

  throw new Error(`不支援的 AI 服務商：${provider}`)
}

export async function extractFileText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'csv' || mimeType === 'text/csv' || mimeType === 'text/plain') {
    return buffer.toString('utf-8')
  }

  if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as {
      read: (b: Buffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> }
      utils: { sheet_to_json: (ws: unknown, o: { header: number; defval: string }) => string[][] }
    }
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
      lines.push(`=== Sheet: ${sheetName} ===`)
      for (const row of rows) lines.push(row.map((c: unknown) => String(c ?? '')).join('\t'))
    }
    return lines.join('\n')
  }

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      const raw = buffer.toString('latin1')
      const texts = raw.match(/\(([^)]{1,200})\)/g) ?? []
      return texts.map(t => t.slice(1, -1)).join(' ')
    }
  }

  throw new Error(`不支援的檔案格式：${ext || mimeType}`)
}

export function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  const objStart = cleaned.indexOf('{')
  const objEnd = cleaned.lastIndexOf('}')
  if (objStart !== -1 && objEnd !== -1) cleaned = cleaned.slice(objStart, objEnd + 1)
  return JSON.parse(cleaned) as T
}

// ── PDF → images via mupdf (WASM, works on Vercel, no native deps) ───────────

/**
 * Convert a PDF buffer to an array of base64-encoded PNG strings (one per page).
 * Limits to MAX_PAGES to avoid token overflow.
 * Falls back to empty array on error so callers can fall back to text extraction.
 */
async function pdfToImages(pdfBuffer: Buffer, maxPages = 8): Promise<string[]> {
  try {
    // mupdf is an ESM-only package; use dynamic import
    const mupdfModule = await import('mupdf')
    const mupdf = mupdfModule.default ?? mupdfModule

    // mupdf.Document.openDocument expects ArrayBuffer or Uint8Array
    const data = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
    const doc = (mupdf.Document as { openDocument: (d: Uint8Array, magic: string) => {
      countPages: () => number
      loadPage: (n: number) => {
        getBounds: () => [number, number, number, number]
        toPixmap: (matrix: unknown, cs: unknown, alpha: boolean, extras: boolean) => {
          asPNG: () => Uint8Array
          destroy?: () => void
        }
        destroy?: () => void
      }
    } }).openDocument(data, 'application/pdf')

    const pageCount = doc.countPages()
    const limit = Math.min(pageCount, maxPages)
    const images: string[] = []

    for (let i = 0; i < limit; i++) {
      const page = doc.loadPage(i)
      const bounds = page.getBounds()                    // [x0, y0, x1, y1]
      const pageWidth = bounds[2] - bounds[0]
      // Target ~1600px wide for good OCR quality without excessive token cost
      const scale = Math.min(1600 / pageWidth, 2.5)
      const matrix = (mupdf.Matrix as { scale: (sx: number, sy: number) => unknown }).scale(scale, scale)
      const cs = (mupdf.ColorSpace as { DeviceRGB: unknown }).DeviceRGB
      const pixmap = page.toPixmap(matrix, cs, false, true)
      images.push(Buffer.from(pixmap.asPNG()).toString('base64'))
      pixmap.destroy?.()
      page.destroy?.()
    }

    return images
  } catch (err) {
    console.warn('[pdfToImages] mupdf failed, will fall back to text extraction:', err)
    return []
  }
}

/**
 * Build the LLM messages array for a file upload.
 *
 * - PDF  → convert pages to PNG images, use Vision API (much better accuracy)
 * - Image → send directly as Vision
 * - Excel / CSV / text → extract as text, send as plain message
 *
 * Falls back to text extraction if mupdf conversion fails.
 */
export async function buildMessagesForFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  systemPrompt: string,
  userPromptText: string,
  provider: string,
): Promise<{ role: string; content: unknown }[]> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf' || mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')

  // ── PDF: convert to images then use Vision ──────────────────────────────
  if (isPdf) {
    const images = await pdfToImages(buffer)

    if (images.length > 0) {
      const imageContent = images.map(b64 =>
        provider === 'openai'
          ? { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' } }
          : { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } }
      )

      return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          ...imageContent,
          { type: 'text', text: `${userPromptText}（共 ${images.length} 頁）` },
        ]},
      ]
    }

    // Fallback: mupdf failed → use pdf-parse text extraction
    console.warn('[buildMessagesForFile] Vision fallback: using pdf-parse text for', filename)
  }

  // ── Image: send directly as Vision ─────────────────────────────────────
  if (isImage) {
    const b64 = buffer.toString('base64')
    const imageItem = provider === 'openai'
      ? { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } }

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [imageItem, { type: 'text', text: userPromptText }] },
    ]
  }

  // ── Everything else: extract text ──────────────────────────────────────
  const text = await extractFileText(buffer, mimeType, filename)
  const truncated = text.length > 60000 ? text.slice(0, 60000) + '\n...[已截斷]' : text
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${userPromptText}\n\n${truncated}` },
  ]
}
