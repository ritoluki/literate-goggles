import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { privateBackendFetch } from '../_backend'
import { SESSION_COOKIE } from '../_auth'

export const dynamic = 'force-dynamic'

const emptyCart = {
  revision: 'empty', currency: 'vnd', items: [], promotionCodes: [],
  subtotalVnd: 0, discountVnd: 0, shippingVnd: null,
  taxVnd: 0, totalVnd: 0, canCheckout: false, warnings: [],
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.json({ data: emptyCart, requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/cart')
    if (!upstream?.ok) throw new Error('Cart unavailable')
    const payload = await upstream.json() as { cart?: unknown }
    if (!payload.cart || typeof payload.cart !== 'object') throw new Error('Bad cart response')
    return NextResponse.json({ data: payload.cart, requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({
      error: { code: 'CART_UNAVAILABLE', message: 'Giỏ hàng tạm thời không khả dụng.', retryable: true },
      requestId,
    }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
