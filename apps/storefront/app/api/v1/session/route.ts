import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { allowedSiteOrigin, csrfFor, SESSION_COOKIE, SESSION_MAX_AGE, validWriteOrigin } from '../_auth'

export const dynamic = 'force-dynamic'

function fail(status: number, code: string) {
  return NextResponse.json({ error: { code } }, {
    status, headers: { 'Cache-Control': 'private, no-store' },
  })
}

function config() {
  const key = process.env.MEDUSA_PUBLISHABLE_KEY
  const serviceKey = process.env.BFF_SERVICE_KEY
  const backendUrl = process.env.BACKEND_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:9000' : undefined)
  if (!key || !serviceKey || !backendUrl || !process.env.CSRF_SECRET ||
    process.env.CSRF_SECRET.length < 32) return null
  return { key, serviceKey, backendUrl }
}

export async function POST(request: NextRequest) {
  if (!validWriteOrigin(request)) return fail(403, 'INVALID_ORIGIN')
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return fail(415, 'JSON_REQUIRED')
  }
  if (Number(request.headers.get('content-length') ?? 0) > 64) return fail(400, 'INVALID_SESSION_BODY')
  const reader = request.body?.getReader()
  if (!reader) return fail(400, 'INVALID_SESSION_BODY')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.byteLength
    if (size > 64) {
      await reader.cancel()
      return fail(400, 'INVALID_SESSION_BODY')
    }
    chunks.push(part.value)
  }
  const body = Buffer.concat(chunks).toString('utf8')
  if (body.trim() !== '{}') return fail(400, 'INVALID_SESSION_BODY')
  const settings = config()
  if (!settings) return fail(503, 'SESSION_CONFIG_UNAVAILABLE')
  const token = randomBytes(32).toString('base64url')
  try {
    const response = await fetch(new URL('/store/bff/session', settings.backendUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-publishable-api-key': settings.key,
        'x-bg-service-key': settings.serviceKey,
        'x-bg-session-token': token,
      },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status !== 201) return fail(503, 'SESSION_UNAVAILABLE')
    const csrfToken = csrfFor(token)
    if (!csrfToken) return fail(503, 'SESSION_CONFIG_UNAVAILABLE')
    const result = NextResponse.json({ data: { csrfToken } }, {
      status: 201, headers: { 'Cache-Control': 'private, no-store' },
    })
    result.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: allowedSiteOrigin(request)?.startsWith('https:') ?? false,
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
    return result
  } catch {
    return fail(503, 'SESSION_UNAVAILABLE')
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return fail(404, 'SESSION_NOT_FOUND')
  const settings = config()
  if (!settings) return fail(503, 'SESSION_CONFIG_UNAVAILABLE')
  try {
    const response = await fetch(new URL('/store/bff/session', settings.backendUrl), {
      headers: {
        'x-publishable-api-key': settings.key,
        'x-bg-service-key': settings.serviceKey,
        'x-bg-session-token': token,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 404) return fail(404, 'SESSION_NOT_FOUND')
    if (!response.ok) return fail(503, 'SESSION_UNAVAILABLE')
    return NextResponse.json({ data: { csrfToken: csrfFor(token) } }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return fail(503, 'SESSION_UNAVAILABLE')
  }
}
