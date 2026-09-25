import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../_auth'
import { readJsonBody } from '../../_body'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'
const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const fail = (status: number, code: string) => NextResponse.json({
    error: { code, message: 'Unable to complete the order.', retryable: status >= 500 }, requestId,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  if (!validWriteOrigin(request) || !validCsrf(request)) return fail(403, 'CHECKOUT_WRITE_FORBIDDEN')
  const key = request.headers.get('idempotency-key')
  if (!key || !IDEMPOTENCY_KEY.test(key)) return fail(400, 'INVALID_CHECKOUT_INTENT')
  const value = await readJsonBody(request, 2200)
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length !== 1 || typeof (value as { reviewToken?: unknown }).reviewToken !== 'string' ||
    (value as { reviewToken: string }).reviewToken.length > 2048) return fail(400, 'INVALID_CHECKOUT_INTENT')
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/checkout/complete', {
      method: 'POST', body: JSON.stringify(value), idempotencyKey: key,
    })
    if (!upstream) return fail(503, 'CHECKOUT_CONFIG_UNAVAILABLE')
    const payload = await upstream.json()
    if (!upstream.ok) return NextResponse.json({ error: payload.error ?? { code: 'CHECKOUT_FAILED' }, requestId }, {
      status: upstream.status, headers: { 'Cache-Control': 'private, no-store' },
    })
    return NextResponse.json({ data: payload.data, requestId }, {
      status: upstream.status, headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch { return fail(503, 'CHECKOUT_COMPLETION_UNAVAILABLE') }
}
