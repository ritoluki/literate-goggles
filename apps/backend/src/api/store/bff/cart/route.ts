import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { cartContext, cartSnapshot, emptyCartSnapshot } from '../../../../cart/cart'
import { resolveSession } from '../../../../identity/session'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const session = await resolveSession(req)
  if (!session) return res.status(401).json({ error: { code: 'SESSION_REQUIRED' } })
  if (!session.cart_id) return res.json({ cart: emptyCartSnapshot() })
  const context = await cartContext(req)
  if (!context) return res.status(503).json({ error: { code: 'CART_CONTEXT_UNAVAILABLE' } })
  try {
    const cart = await cartSnapshot(context.query, session.cart_id, context.channelId)
    return res.json({ cart })
  } catch {
    return res.status(503).json({ error: { code: 'CART_UNAVAILABLE' } })
  }
}
