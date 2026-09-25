import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { deleteLineItemsWorkflow, updateLineItemInCartWorkflow } from '@medusajs/medusa/core-flows'
import { cartContext, cartSnapshot } from '../../../../../../cart/cart'
import { resolveSession } from '../../../../../../identity/session'

const LINE_ID = /^cali_[A-Za-z0-9]+$/

async function ownedLine(req: MedusaStoreRequest) {
  const session = await resolveSession(req)
  if (!session?.cart_id || !LINE_ID.test(req.params.lineId)) return null
  const context = await cartContext(req)
  if (!context) return null
  const { data } = await context.query.graph({
    entity: 'cart',
    fields: ['id', 'region_id', 'sales_channel_id', 'currency_code', 'completed_at', 'items.id'],
    filters: { id: session.cart_id },
  })
  const cart = data[0]
  if (!cart || cart.completed_at || cart.region_id !== context.regionId ||
    cart.sales_channel_id !== context.channelId || cart.currency_code !== 'vnd' ||
    !cart.items?.some((item) => item?.id === req.params.lineId)) {
    return null
  }
  return { context, cartId: session.cart_id, lineId: req.params.lineId }
}

export async function PATCH(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).join(',') !== 'quantity' ||
    !Number.isInteger((body as { quantity?: unknown }).quantity) ||
    (body as { quantity: number }).quantity < 1 ||
    (body as { quantity: number }).quantity > 10) {
    return res.status(400).json({ error: { code: 'INVALID_QUANTITY' } })
  }
  const target = await ownedLine(req)
  if (!target) return res.status(404).json({ error: { code: 'CART_LINE_NOT_FOUND' } })
  try {
    await updateLineItemInCartWorkflow(req.scope).run({
      input: {
        cart_id: target.cartId,
        item_id: target.lineId,
        update: { quantity: (body as { quantity: number }).quantity },
      },
    })
    return res.json({ cart: await cartSnapshot(target.context.query, target.cartId, target.context.channelId) })
  } catch {
    return res.status(409).json({ error: { code: 'CART_LINE_REJECTED' } })
  }
}

export async function DELETE(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const target = await ownedLine(req)
  if (!target) return res.status(404).json({ error: { code: 'CART_LINE_NOT_FOUND' } })
  try {
    await deleteLineItemsWorkflow(req.scope).run({
      input: { cart_id: target.cartId, ids: [target.lineId] },
    })
    return res.json({ cart: await cartSnapshot(target.context.query, target.cartId, target.context.channelId) })
  } catch {
    return res.status(409).json({ error: { code: 'CART_LINE_REJECTED' } })
  }
}
