import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../../_auth'
import { readJsonBody } from '../../../_body'
import { privateBackendFetch } from '../../../_backend'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ lineId: string }> }

function fail(status: number, code: string, requestId: string) {
  return NextResponse.json({
    error: { code, message: 'Không thể cập nhật giỏ hàng.', retryable: status >= 500 },
    requestId,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

async function mutate(request: NextRequest, context: Context, method: 'PATCH' | 'DELETE') {
  const requestId = randomUUID()
  if (!validWriteOrigin(request) || !validCsrf(request)) {
    return fail(403, 'CART_WRITE_FORBIDDEN', requestId)
  }
  const { lineId } = await context.params
  if (!/^cali_[A-Za-z0-9]+$/.test(lineId)) return fail(404, 'CART_LINE_NOT_FOUND', requestId)
  let body: string | undefined
  if (method === 'PATCH') {
    const value = await readJsonBody(request, 64)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fail(400, 'INVALID_QUANTITY', requestId)
    }
    const input = value as Record<string, unknown>
    if (Object.keys(input).join(',') !== 'quantity' ||
      !Number.isInteger(input.quantity) || (input.quantity as number) < 1 ||
      (input.quantity as number) > 10) return fail(400, 'INVALID_QUANTITY', requestId)
    body = JSON.stringify({ quantity: input.quantity })
  }
  try {
    const upstream = await privateBackendFetch(request,
      '/store/bff/cart/items/' + lineId, { method, body })
    if (!upstream) return fail(503, 'CART_CONFIG_UNAVAILABLE', requestId)
    if (upstream.status === 404) return fail(404, 'CART_LINE_NOT_FOUND', requestId)
    if (upstream.status === 400 || upstream.status === 409) {
      return fail(upstream.status, 'CART_LINE_REJECTED', requestId)
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

export function PATCH(request: NextRequest, context: Context) {
  return mutate(request, context, 'PATCH')
}

export function DELETE(request: NextRequest, context: Context) {
  return mutate(request, context, 'DELETE')
}
