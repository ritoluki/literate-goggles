import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from './_auth'

export function backendConfig() {
  const key = process.env.MEDUSA_PUBLISHABLE_KEY
  const serviceKey = process.env.BFF_SERVICE_KEY
  const backendUrl = process.env.BACKEND_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:9000' : undefined)
  return key && serviceKey && backendUrl ? { key, serviceKey, backendUrl } : null
}

export async function privateBackendFetch(
  request: NextRequest,
  path: string,
  init: { method?: string; body?: string } = {}
) {
  const config = backendConfig()
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!config || !token) return null
  return fetch(new URL(path, config.backendUrl), {
    method: init.method ?? 'GET',
    headers: {
      'x-publishable-api-key': config.key,
      'x-bg-service-key': config.serviceKey,
      'x-bg-session-token': token,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
}
