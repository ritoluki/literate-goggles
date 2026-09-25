import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../_auth'
import { readJsonBody } from '../../_body'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  const requestId = randomUUID()
  const fail = (status: number, code: string) => NextResponse.json({
    error: { code, message: 'Không thể chọn phương thức vận chuyển.', retryable: status >= 500 }, requestId,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  if (!validWriteOrigin(request) || !validCsrf(request)) return fail(403, 'CHECKOUT_WRITE_FORBIDDEN')
  const value = await readJsonBody(request, 96)
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).join(',') !== 'optionId' || typeof (value as { optionId?: unknown }).optionId !== 'string' ||
    !/^so_[A-Za-z0-9]+$/.test((value as { optionId: string }).optionId)) {
    return fail(400, 'INVALID_SHIPPING_OPTION')
  }
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/checkout/shipping', {
      method: 'PUT', body: JSON.stringify(value),
    })
    if (!upstream) return fail(503, 'CHECKOUT_CONFIG_UNAVAILABLE')
    if (upstream.status === 400 || upstream.status === 409) return fail(upstream.status, 'SHIPPING_OPTION_UNAVAILABLE')
    if (!upstream.ok) return fail(503, 'SHIPPING_SELECTION_UNAVAILABLE')
    return NextResponse.json({ data: await upstream.json(), requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch { return fail(503, 'SHIPPING_SELECTION_UNAVAILABLE') }
}
