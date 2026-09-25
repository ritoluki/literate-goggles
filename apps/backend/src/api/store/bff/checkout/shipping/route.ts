import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { cartSnapshot, ownedCheckoutCart, quoteCartShipping, selectCartShipping } from '../../../../../checkout/checkout'

export async function PUT(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).join(',') !== 'optionId' || typeof (body as { optionId?: unknown }).optionId !== 'string' ||
    !/^so_[A-Za-z0-9]+$/.test((body as { optionId: string }).optionId)) {
    return res.status(400).json({ error: { code: 'INVALID_SHIPPING_OPTION' } })
  }
  const target = await ownedCheckoutCart(req)
  if (!target) return res.status(409).json({ error: { code: 'CART_UNAVAILABLE' } })
  if (!target.cart.shipping_address || !target.cart.email) {
    return res.status(409).json({ error: { code: 'ADDRESS_REQUIRED' } })
  }
  const optionId = (body as { optionId: string }).optionId
  try {
    const options = await quoteCartShipping(req, target.cartId)
    if (!options.some((option) => option.id === optionId)) {
      return res.status(409).json({ error: { code: 'SHIPPING_OPTION_UNAVAILABLE' } })
    }
    await selectCartShipping(req, target.cartId, optionId)
    return res.json({ cart: await cartSnapshot(target.context.query, target.cartId, target.context.channelId) })
  } catch {
    return res.status(409).json({ error: { code: 'SHIPPING_SELECTION_REJECTED' } })
  }
}
