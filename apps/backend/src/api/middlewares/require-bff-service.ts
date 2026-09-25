import { createHash, timingSafeEqual } from 'node:crypto'
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'

export function requireBffService(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  res.setHeader('Cache-Control', 'private, no-store')
  const expected = process.env.BFF_SERVICE_KEY
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: { code: 'BFF_SERVICE_UNAVAILABLE' } })
  }
  const actual = req.get('x-bg-service-key')
  if (!actual || actual.length > 256) {
    return res.status(403).json({ error: { code: 'BFF_SERVICE_FORBIDDEN' } })
  }
  const digest = (value: string) => createHash('sha256').update(value).digest()
  if (!timingSafeEqual(digest(actual), digest(expected))) {
    return res.status(403).json({ error: { code: 'BFF_SERVICE_FORBIDDEN' } })
  }
  next()
}
