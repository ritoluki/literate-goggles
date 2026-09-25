import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { PromotionActions } from '@medusajs/framework/utils'
import { updateCartPromotionsWorkflow } from '@medusajs/medusa/core-flows'
import { cartContext, cartSnapshot, emptyCartSnapshot } from '../../../../../cart/cart'
import { resolveSession } from '../../../../../identity/session'

async function ownedCart(req: MedusaStoreRequest) {
  const session = await resolveSession(req)
  if (!session) return null
  const context = await cartContext(req)
  if (!context) return null
  if (session.cart_id) {
    const { data } = await context.query.graph({
      entity: 'cart',
      fields: ['id', 'region_id', 'sales_channel_id', 'currency_code', 'completed_at'],
      filters: { id: session.cart_id },
    })
    const cart = data[0]
    if (!cart || cart.region_id !== context.regionId ||
      cart.sales_channel_id !== context.channelId ||
      cart.currency_code !== 'vnd' || cart.completed_at) return null
  }
  return { context, cartId: session.cart_id }
}

export async function PUT(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).join(',') !== 'code' ||
    typeof (body as { code?: unknown }).code !== 'string' ||
    !/^[A-Za-z0-9_-]{2,32}$/.test((body as { code: string }).code)) {
    return res.status(400).json({ error: { code: 'INVALID_PROMOTION_CODE' } })
  }
  const target = await ownedCart(req)
  if (!target?.cartId) return res.status(409).json({ error: { code: 'CART_EMPTY' } })
  const code = (body as { code: string }).code
  try {
    await updateCartPromotionsWorkflow(req.scope).run({
      input: { cart_id: target.cartId, promo_codes: [code], action: PromotionActions.ADD },
    })
    const cart = await cartSnapshot(target.context.query, target.cartId, target.context.channelId)
    if (!cart.promotionCodes.some((applied) => applied.toLowerCase() === code.toLowerCase())) {
      return res.status(409).json({ error: { code: 'PROMOTION_NOT_APPLICABLE' } })
    }
    return res.json({ cart })
  } catch {
    return res.status(409).json({ error: { code: 'PROMOTION_REJECTED' } })
  }
}

export async function DELETE(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  if (body && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) {
    return res.status(400).json({ error: { code: 'INVALID_PROMOTION_BODY' } })
  }
  const target = await ownedCart(req)
  if (!target) return res.status(401).json({ error: { code: 'SESSION_REQUIRED' } })
  if (!target.cartId) return res.json({ cart: emptyCartSnapshot() })
  try {
    const before = await cartSnapshot(target.context.query, target.cartId, target.context.channelId)
    if (before.promotionCodes.length) {
      await updateCartPromotionsWorkflow(req.scope).run({
        input: {
          cart_id: target.cartId,
          promo_codes: before.promotionCodes,
          action: PromotionActions.REMOVE,
        },
      })
    }
    return res.json({
      cart: await cartSnapshot(target.context.query, target.cartId, target.context.channelId),
    })
  } catch {
    return res.status(409).json({ error: { code: 'PROMOTION_REJECTED' } })
  }
}
