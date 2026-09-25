import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { resolveSession } from '../../identity/session'

export async function requireCommerceSession(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    if (!await resolveSession(req)) {
      return res.status(401).json({ error: { code: 'SESSION_REQUIRED' } })
    }
    next()
  } catch {
    return res.status(503).json({ error: { code: 'SESSION_UNAVAILABLE' } })
  }
}
