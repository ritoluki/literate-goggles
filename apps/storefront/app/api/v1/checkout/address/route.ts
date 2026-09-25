import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../_auth'
import { readJsonBody } from '../../_body'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'

function fail(status: number, code: string) {
  return NextResponse.json({ error: { code, message: status === 422
    ? 'Địa chỉ này hiện chưa được hỗ trợ giao hàng.'
    : 'Chưa thể cập nhật địa chỉ giao hàng.', retryable: status >= 500 }, requestId: randomUUID() }, {
    status, headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/checkout/address')
    if (!upstream) return fail(503, 'CHECKOUT_CONFIG_UNAVAILABLE')
    if (upstream.status === 404) return fail(404, 'ADDRESS_NOT_FOUND')
    if (!upstream.ok) return fail(409, 'CART_UNAVAILABLE')
    return NextResponse.json({ data: await upstream.json(), requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch { return fail(503, 'CHECKOUT_UNAVAILABLE') }
}

export async function PUT(request: NextRequest) {
  if (!validWriteOrigin(request) || !validCsrf(request)) return fail(403, 'CHECKOUT_WRITE_FORBIDDEN')
  const value = await readJsonBody(request, 4096)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(400, 'INVALID_CHECKOUT_ADDRESS')
  const input = value as Record<string, unknown>
  if (Object.keys(input).sort().join(',') !== 'address,email' || typeof input.email !== 'string' ||
    !input.address || typeof input.address !== 'object' || Array.isArray(input.address)) {
    return fail(400, 'INVALID_CHECKOUT_ADDRESS')
  }
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/checkout/address', {
      method: 'PUT', body: JSON.stringify(input),
    })
    if (!upstream) return fail(503, 'CHECKOUT_CONFIG_UNAVAILABLE')
    if (upstream.status === 400 || upstream.status === 409 || upstream.status === 422) {
      const payload = await upstream.json() as { error?: { code?: string } }
      const code = payload.error?.code === 'ADDRESS_UNSUPPORTED' ? 'ADDRESS_UNSUPPORTED' : 'INVALID_CHECKOUT_ADDRESS'
      return fail(upstream.status, code)
    }
    if (!upstream.ok) return fail(503, 'SHIPPING_QUOTE_UNAVAILABLE')
    const payload = await upstream.json()
    return NextResponse.json({ data: payload, requestId: randomUUID() }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch { return fail(503, 'SHIPPING_QUOTE_UNAVAILABLE') }
}
