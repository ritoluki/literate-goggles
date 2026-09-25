import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SESSION_MAX_AGE_SECONDS, resolveSession, tokenHash } from '../../../../identity/session'
import { COMMERCE_IDENTITY_MODULE } from '../../../../modules/commerce-identity'
import type CommerceIdentityService from '../../../../modules/commerce-identity/service'
import { createCommerceSessionWorkflow } from '../../../../workflows/create-commerce-session'
import { allowSessionCreate } from '../../../../identity/session-rate-limit'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
    Object.keys(req.body).length !== 0) {
    return res.status(400).json({ error: { code: 'INVALID_SESSION_BODY' } })
  }
  const hash = tokenHash(req.get('x-bg-session-token') ?? '')
  if (!hash) return res.status(400).json({ error: { code: 'INVALID_SESSION_TOKEN' } })
  try {
    if (!await allowSessionCreate(req.ip)) {
      return res.status(429).json({ error: { code: 'SESSION_RATE_LIMITED' } })
    }
  } catch {
    return res.status(503).json({ error: { code: 'SESSION_RATE_LIMIT_UNAVAILABLE' } })
  }
  const identity = req.scope.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const existing = await identity.listCommerceSessions({ token_hash: hash })
  if (existing.length) return res.status(409).json({ error: { code: 'SESSION_EXISTS' } })
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
  await createCommerceSessionWorkflow(req.scope).run({
    input: { token_hash: hash, expires_at: expiresAt },
  })
  return res.status(201).json({ expiresAt: expiresAt.toISOString() })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const session = await resolveSession(req)
  if (!session) return res.status(404).json({ error: { code: 'SESSION_NOT_FOUND' } })
  return res.json({ expiresAt: new Date(session.expires_at).toISOString() })
}
