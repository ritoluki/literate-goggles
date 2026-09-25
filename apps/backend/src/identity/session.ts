import { createHash } from 'node:crypto'
import type { MedusaRequest } from '@medusajs/framework/http'
import { COMMERCE_IDENTITY_MODULE } from '../modules/commerce-identity'
import type CommerceIdentityService from '../modules/commerce-identity/service'

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function tokenHash(token: string): string | null {
  if (!TOKEN_RE.test(token)) return null
  return createHash('sha256').update(token).digest('hex')
}

export async function resolveSession(req: MedusaRequest) {
  const hash = tokenHash(req.get('x-bg-session-token') ?? '')
  if (!hash) return null
  const identity = req.scope.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const sessions = await identity.listCommerceSessions({ token_hash: hash })
  const session = sessions[0]
  return session && new Date(session.expires_at).getTime() > Date.now() ? session : null
}

export async function ownsCart(req: MedusaRequest, cartId: string): Promise<boolean> {
  const session = await resolveSession(req)
  return Boolean(session?.cart_id && session.cart_id === cartId)
}
