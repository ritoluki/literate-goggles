import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { privateBackendFetch } from '../../_backend'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  try {
    const upstream = await privateBackendFetch(request, '/store/bff/checkout/shipping-options')
    if (!upstream) return NextResponse.json({ error: { code: 'SHIPPING_OPTIONS_UNAVAILABLE' }, requestId }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    })
    if (!upstream.ok) return NextResponse.json({ error: { code: 'ADDRESS_REQUIRED' }, requestId }, {
      status: upstream.status, headers: { 'Cache-Control': 'private, no-store' },
    })
    return NextResponse.json({ data: await upstream.json(), requestId }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({ error: { code: 'SHIPPING_OPTIONS_UNAVAILABLE', retryable: true }, requestId }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
