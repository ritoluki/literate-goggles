import { NextResponse, type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

type CatalogPayload = {
  products: unknown[]
  total: number
  page: number
  limit: number
}

function fail(status: number, code: string, requestId: string) {
  return NextResponse.json({
    error: { code, message: status === 400 ? 'Bộ lọc sản phẩm không hợp lệ.' : 'Catalog đang tạm thời không khả dụng.', retryable: status >= 500 },
    requestId,
  }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const key = process.env.MEDUSA_PUBLISHABLE_KEY
  const backendUrl = process.env.BACKEND_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:9000' : undefined)
  if (!key || !backendUrl) return fail(503, 'CATALOG_CONFIG_UNAVAILABLE', requestId)

  try {
    const upstream = new URL('/store/catalog-v1', backendUrl)
    upstream.search = request.nextUrl.searchParams.toString()
    const response = await fetch(upstream, {
      headers: { 'x-publishable-api-key': key },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 400) return fail(400, 'INVALID_CATALOG_QUERY', requestId)
    if (!response.ok) return fail(503, 'CATALOG_UNAVAILABLE', requestId)
    const payload = await response.json() as CatalogPayload
    if (!Array.isArray(payload.products) || !Number.isSafeInteger(payload.total) ||
      !Number.isSafeInteger(payload.page) || !Number.isSafeInteger(payload.limit)) {
      return fail(503, 'CATALOG_BAD_RESPONSE', requestId)
    }
    return NextResponse.json({ data: payload, requestId }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return fail(503, 'CATALOG_UNAVAILABLE', requestId)
  }
}
