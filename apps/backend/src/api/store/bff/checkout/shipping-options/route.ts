import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { ownedCheckoutCart, quoteCartShipping } from '../../../../../checkout/checkout'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const target = await ownedCheckoutCart(req)
  if (!target) return res.status(409).json({ error: { code: 'CART_UNAVAILABLE' } })
  if (!target.cart.shipping_address || !target.cart.email) {
    return res.status(409).json({ error: { code: 'ADDRESS_REQUIRED' } })
  }
  try {
    return res.json({ shippingOptions: await quoteCartShipping(req, target.cartId) })
  } catch {
    return res.status(503).json({ error: { code: 'SHIPPING_QUOTE_UNAVAILABLE' } })
  }
}
