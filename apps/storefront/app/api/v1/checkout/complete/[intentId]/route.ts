import { NextResponse, type NextRequest } from 'next/server'
import { privateBackendFetch } from '../../../_backend'

export const dynamic = 'force-dynamic'
const INTENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest, context: { params: Promise<{ intentId: string }> }) {
  const { intentId } = await context.params
  if (!INTENT_ID.test(intentId)) return NextResponse.json({ error: { code: 'INTENT_NOT_FOUND' } }, {
    status: 404, headers: { 'Cache-Control': 'private, no-store' },
  })
  try {
    const upstream = await privateBackendFetch(request, `/store/bff/checkout/complete/${intentId}`)
    if (!upstream) return NextResponse.json({ error: { code: 'CHECKOUT_CONFIG_UNAVAILABLE' } }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    })
    const payload = await upstream.json()
    return NextResponse.json(payload, { status: upstream.status,
      headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: { code: 'CHECKOUT_STATUS_UNAVAILABLE' } }, {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}
