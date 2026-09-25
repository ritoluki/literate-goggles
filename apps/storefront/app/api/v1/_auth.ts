import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export const SESSION_COOKIE = 'bg_session'
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60

export function allowedSiteOrigin(request: NextRequest): string | null {
  const configured = process.env.SITE_ORIGIN
  if (configured) {
    try {
      const origin = new URL(configured)
      if (origin.origin !== configured || (origin.protocol !== 'https:' &&
        !(process.env.APP_MODE === 'demo' && origin.hostname === '127.0.0.1'))) return null
      return origin.origin
    } catch { return null }
  }
  if (process.env.NODE_ENV !== 'development') return null
  const candidate = request.headers.get('origin')
  return candidate === 'http://127.0.0.1:3000' || candidate === 'http://localhost:3000'
    ? candidate : null
}

export function validWriteOrigin(request: NextRequest): boolean {
  const expected = allowedSiteOrigin(request)
  return Boolean(expected && request.headers.get('origin') === expected)
}

export function csrfFor(sessionToken: string): string | null {
  const secret = process.env.CSRF_SECRET
  if (!secret || secret.length < 32) return null
  return createHmac('sha256', secret).update(sessionToken).digest('base64url')
}

export function validCsrf(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const actual = request.headers.get('x-bg-csrf-token')
  const expected = token ? csrfFor(token) : null
  if (!actual || !expected || actual.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
