import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../_auth'
import { readJsonBody } from '../../_body'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const fail = (status: number, code: string) => NextResponse.json({
    error: { code, message: 'Chưa thể xác minh thông tin đơn hàng.', retryable: status >= 500 }, requestId,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  if (!validWriteOrigin(request) || !validCsrf(request)) return fail(403, 'CHECKOUT_WRITE_FORBIDDEN')
  const value = await readJsonBody(request, 64)
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length !== 1 || (value as { method?: unknown }).method !== 'cod') {
    return fail(400, 'INVALID_PAYMENT_METHOD')
  }
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/checkout/review', {
      method: 'POST', body: JSON.stringify(value),
    })
    if (!upstream) return fail(503, 'CHECKOUT_CONFIG_UNAVAILABLE')
    if (upstream.status === 400 || upstream.status === 409) return fail(upstream.status, 'CHECKOUT_INCOMPLETE')
    if (!upstream.ok) return fail(503, 'CHECKOUT_REVIEW_UNAVAILABLE')
    return NextResponse.json({ data: await upstream.json(), requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch { return fail(503, 'CHECKOUT_REVIEW_UNAVAILABLE') }
}
