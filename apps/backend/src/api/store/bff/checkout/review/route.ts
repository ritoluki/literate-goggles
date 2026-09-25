import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { cartSnapshot } from '../../../../../cart/cart'
import { resolveSession } from '../../../../../identity/session'
import { ensureCodPaymentSession, ownedCheckoutCart } from '../../../../../checkout/checkout'
import { createReviewToken, reviewTokenConfigured } from '../../../../../checkout/review-token'

export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).length !== 1 || (body as { method?: unknown }).method !== 'cod') {
    return res.status(400).json({ error: { code: 'INVALID_PAYMENT_METHOD' } })
  }
  if (!reviewTokenConfigured()) return res.status(503).json({ error: { code: 'REVIEW_TOKEN_CONFIG_UNAVAILABLE' } })
  const target = await ownedCheckoutCart(req)
  const session = await resolveSession(req)
  const shippingMethodId = target?.cart.shipping_methods?.[0]?.id
  if (!target || !session?.id || !target.cart.email || !target.cart.shipping_address ||
    !shippingMethodId) {
    return res.status(409).json({ error: { code: 'CHECKOUT_INCOMPLETE' } })
  }
  try {
    const snapshot = await cartSnapshot(target.context.query, target.cartId, target.context.channelId)
    if (snapshot.shippingVnd === null || !snapshot.items.length || snapshot.items.some((item) => !item.available)) {
      return res.status(409).json({ error: { code: 'CART_NOT_READY' }, cart: snapshot })
    }
    const paymentSession = await ensureCodPaymentSession(req, target.cartId, target.context.query)
    const claims = createReviewToken({ sid: session.id, cid: target.cartId, fingerprint: snapshot.revision,
      total: snapshot.totalVnd, currency: 'vnd', shipping: shippingMethodId,
      payment: 'cod', paymentSession })
    return res.json({ reviewToken: claims.token, expiresAt: claims.expiresAt, paymentMethod: 'cod',
      cart: snapshot })
  } catch {
    return res.status(503).json({ error: { code: 'CHECKOUT_REVIEW_UNAVAILABLE' } })
  }
}
