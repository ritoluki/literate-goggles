import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../_auth'
import { readJsonBody } from '../../_body'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'

function fail(status: number, code: string, requestId: string) {
  return NextResponse.json({
    error: { code, message: 'Không thể cập nhật giỏ hàng.', retryable: status >= 500 },
    requestId,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  if (!validWriteOrigin(request) || !validCsrf(request)) return fail(403, 'CART_WRITE_FORBIDDEN', requestId)
  const value = await readJsonBody(request, 256)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(400, 'INVALID_CART_ITEM', requestId)
  }
  const input = value as Record<string, unknown>
  if (Object.keys(input).sort().join(',') !== 'quantity,variantId' ||
    typeof input.variantId !== 'string' || !/^variant_[A-Za-z0-9]+$/.test(input.variantId) ||
    !Number.isInteger(input.quantity) || (input.quantity as number) < 1 ||
    (input.quantity as number) > 10) return fail(400, 'INVALID_CART_ITEM', requestId)
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/cart/items', {
      method: 'POST',
      body: JSON.stringify({ variantId: input.variantId, quantity: input.quantity }),
    })
    if (!upstream) return fail(503, 'CART_CONFIG_UNAVAILABLE', requestId)
    if (upstream.status === 400 || upstream.status === 409) {
      return fail(upstream.status, 'CART_ITEM_REJECTED', requestId)
    }
    if (!upstream.ok) return fail(503, 'CART_UNAVAILABLE', requestId)
    const payload = await upstream.json() as { cart?: unknown }
    if (!payload.cart || typeof payload.cart !== 'object') {
      return fail(503, 'CART_BAD_RESPONSE', requestId)
    }
    return NextResponse.json({ data: payload.cart, requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return fail(503, 'CART_UNAVAILABLE', requestId)
  }
}
