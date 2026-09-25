import type { NextRequest } from 'next/server'

export async function readJsonBody(request: NextRequest, maxBytes: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return undefined
  }
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return undefined
  const reader = request.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(part.value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch { return undefined }
}
