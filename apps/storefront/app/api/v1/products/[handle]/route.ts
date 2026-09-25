import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function fail(status: number, code: string, requestId: string) {
  return NextResponse.json({
    error: {
      code,
      message: status === 404 ? 'Không tìm thấy sản phẩm.' : 'Thông tin sản phẩm đang tạm thời không khả dụng.',
      retryable: status >= 500,
    },
    requestId,
  }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const requestId = randomUUID()
  const { handle } = await params
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle) || handle.length > 120) {
    return fail(404, 'PRODUCT_NOT_FOUND', requestId)
  }
  const key = process.env.MEDUSA_PUBLISHABLE_KEY
  const serviceKey = process.env.BFF_SERVICE_KEY
  const backendUrl = process.env.BACKEND_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:9000' : undefined)
  if (!key || !serviceKey || !backendUrl) return fail(503, 'PRODUCT_CONFIG_UNAVAILABLE', requestId)

  try {
    const response = await fetch(new URL(`/store/products-v1/${encodeURIComponent(handle)}`, backendUrl), {
      headers: { 'x-publishable-api-key': key, 'x-bg-service-key': serviceKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 404) return fail(404, 'PRODUCT_NOT_FOUND', requestId)
    if (response.status === 400) return fail(400, 'INVALID_PRODUCT_HANDLE', requestId)
    if (!response.ok) return fail(503, 'PRODUCT_UNAVAILABLE', requestId)
    const payload = await response.json() as { product?: unknown }
    if (!payload.product || typeof payload.product !== 'object' || Array.isArray(payload.product)) {
      return fail(503, 'PRODUCT_BAD_RESPONSE', requestId)
    }
    return NextResponse.json({ data: payload.product, requestId }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return fail(503, 'PRODUCT_UNAVAILABLE', requestId)
  }
}
