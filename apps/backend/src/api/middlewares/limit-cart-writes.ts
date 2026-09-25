import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { tokenHash } from '../../identity/session'
import { allowCartWrite } from '../../identity/session-rate-limit'

export async function limitCartWrites(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  res.setHeader('Cache-Control', 'private, no-store')
  const hash = tokenHash(req.get('x-bg-session-token') ?? '')
  if (!hash) return res.status(401).json({ error: { code: 'SESSION_REQUIRED' } })
  try {
    if (!await allowCartWrite(hash)) {
      return res.status(429).json({ error: { code: 'CART_RATE_LIMITED' } })
    }
    next()
  } catch {
    return res.status(503).json({ error: { code: 'CART_RATE_LIMIT_UNAVAILABLE' } })
  }
}
