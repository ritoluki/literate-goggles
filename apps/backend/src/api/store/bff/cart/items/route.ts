import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { addToCartWorkflow } from '@medusajs/medusa/core-flows'
import { cartContext, cartSnapshot } from '../../../../../cart/cart'
import { resolveSession } from '../../../../../identity/session'
import { loadCatalogSources } from '../../../../../search/load-catalog'
import { createSessionCartWorkflow } from '../../../../../workflows/create-session-cart'

type AddItemBody = { variantId: string; quantity: number }
const VARIANT_ID = /^variant_[A-Za-z0-9]+$/

function parseBody(value: unknown): AddItemBody | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (Object.keys(body).sort().join(',') !== 'quantity,variantId') return null
  if (typeof body.variantId !== 'string' || !VARIANT_ID.test(body.variantId) ||
    !Number.isInteger(body.quantity) || (body.quantity as number) < 1 ||
    (body.quantity as number) > 10) return null
  return body as AddItemBody
}

export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const input = parseBody(req.body)
  if (!input) return res.status(400).json({ error: { code: 'INVALID_CART_ITEM' } })
  const session = await resolveSession(req)
  if (!session) return res.status(401).json({ error: { code: 'SESSION_REQUIRED' } })
  const context = await cartContext(req)
  if (!context) return res.status(503).json({ error: { code: 'CART_CONTEXT_UNAVAILABLE' } })

  try {
    const products = await loadCatalogSources(context.query, context.regionId, context.channelId)
    const variant = products.flatMap((product) => product.variants)
      .find((item) => item.id === input.variantId)
    if (!variant || variant.priceVnd === null || !variant.available) {
      return res.status(409).json({ error: { code: 'VARIANT_UNAVAILABLE' } })
    }

    let cartId = session.cart_id
    if (!cartId) {
      try {
        const { result } = await createSessionCartWorkflow(req.scope).run({
          input: {
            session_id: session.id,
            region_id: context.regionId,
            sales_channel_id: context.channelId,
          },
        })
        cartId = result
      } catch {
        const current = await resolveSession(req)
        cartId = current?.cart_id ?? null
        if (!cartId) return res.status(503).json({ error: { code: 'CART_CREATE_UNAVAILABLE' } })
      }
    }
    const { data: carts } = await context.query.graph({
      entity: 'cart',
      fields: ['id', 'region_id', 'sales_channel_id', 'currency_code', 'completed_at',
        'items.variant_id', 'items.quantity'],
      filters: { id: cartId },
    })
    const current = carts[0]
    if (!current || current.region_id !== context.regionId ||
      current.sales_channel_id !== context.channelId ||
      current.currency_code !== 'vnd' || current.completed_at) {
      return res.status(409).json({ error: { code: 'CART_CONTEXT_CHANGED' } })
    }
    const existingQuantity = (current.items ?? [])
      .filter((item) => item?.variant_id === input.variantId)
      .reduce((sum, item) => sum + (item?.quantity ?? 0), 0)
    if (existingQuantity + input.quantity > 10) {
      return res.status(400).json({ error: { code: 'QUANTITY_LIMIT' } })
    }
    await addToCartWorkflow(req.scope).run({
      input: { cart_id: cartId, items: [{ variant_id: input.variantId, quantity: input.quantity }] },
    })
    const cart = await cartSnapshot(context.query, cartId, context.channelId)
    return res.status(200).json({ cart })
  } catch {
    return res.status(409).json({ error: { code: 'CART_ITEM_REJECTED' } })
  }
}
