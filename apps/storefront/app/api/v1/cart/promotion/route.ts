import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { validCsrf, validWriteOrigin } from '../../_auth'
import { readJsonBody } from '../../_body'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'

function fail(status: number, code: string, requestId: string) {
  return NextResponse.json({
    error: { code, message: 'Không thể áp dụng mã giảm giá.', retryable: status >= 500 },
    requestId,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

async function mutate(request: NextRequest, method: 'PUT' | 'DELETE') {
  const requestId = randomUUID()
  if (!validWriteOrigin(request) || !validCsrf(request)) {
    return fail(403, 'CART_WRITE_FORBIDDEN', requestId)
  }
  let body: string | undefined
  if (method === 'PUT') {
    const value = await readJsonBody(request, 128)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fail(400, 'INVALID_PROMOTION_CODE', requestId)
    }
    const input = value as Record<string, unknown>
    if (Object.keys(input).join(',') !== 'code' ||
      typeof input.code !== 'string' || !/^[A-Za-z0-9_-]{2,32}$/.test(input.code)) {
      return fail(400, 'INVALID_PROMOTION_CODE', requestId)
    }
    body = JSON.stringify({ code: input.code })
  } else if (request.body) {
    const reader = request.body.getReader()
    while (true) {
      const part = await reader.read()
      if (part.done) break
      if (part.value.byteLength) {
        await reader.cancel()
        return fail(400, 'INVALID_PROMOTION_BODY', requestId)
      }
    }
  }
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/cart/promotion', { method, body })
    if (!upstream) return fail(503, 'CART_CONFIG_UNAVAILABLE', requestId)
    if (upstream.status === 400 || upstream.status === 409) {
      return fail(upstream.status, 'PROMOTION_REJECTED', requestId)
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

export function PUT(request: NextRequest) {
  return mutate(request, 'PUT')
}

export function DELETE(request: NextRequest) {
  return mutate(request, 'DELETE')
}
