import { createHash } from 'node:crypto'
import type { MedusaStoreRequest } from '@medusajs/framework/http'
import type { RemoteQueryFunction } from '@medusajs/framework/types'
import { BigNumber, ContainerRegistrationKeys, getVariantAvailability, MedusaError } from '@medusajs/framework/utils'

type Query = Omit<RemoteQueryFunction, symbol>

export async function cartContext(req: MedusaStoreRequest) {
  const query = req.scope.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const [{ data: regions }, { data: channels }] = await Promise.all([
    query.graph({ entity: 'region', fields: ['id', 'name', 'currency_code'] }),
    query.graph({ entity: 'sales_channel', fields: ['id', 'name'] }),
  ])
  const region = process.env.CATALOG_REGION_ID
    ? regions.find((item) => item.id === process.env.CATALOG_REGION_ID)
    : process.env.APP_MODE === 'demo'
      ? regions.find((item) => item.name === 'Vietnam Demo') : undefined
  const channel = process.env.CATALOG_SALES_CHANNEL_ID
    ? channels.find((item) => item.id === process.env.CATALOG_SALES_CHANNEL_ID)
    : process.env.APP_MODE === 'demo'
      ? channels.find((item) => item.name === 'Bàn Gọn Storefront (Demo)') : undefined
  if (!region?.id || region.currency_code !== 'vnd' || !channel?.id ||
    !req.publishable_key_context?.sales_channel_ids?.includes(channel.id)) return null
  return { query, regionId: region.id, channelId: channel.id }
}

function integerAmount(value: unknown): number {
  const number = value instanceof BigNumber ? value.numeric :
    typeof value === 'number' ? value :
    typeof value === 'string' ? Number(value) : NaN
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'CART_AMOUNT_INVALID')
  }
  return number
}

export function emptyCartSnapshot() {
  return {
    revision: 'empty', currency: 'vnd', items: [], promotionCodes: [],
    subtotalVnd: 0, discountVnd: 0, shippingVnd: null,
    taxVnd: 0, totalVnd: 0, canCheckout: false, warnings: [],
  }
}

export async function cartSnapshot(query: Query, cartId: string, channelId: string) {
  const { data } = await query.graph({
    entity: 'cart',
    fields: [
      'id', 'currency_code', 'updated_at', 'completed_at',
      'subtotal', 'discount_total', 'shipping_total', 'tax_total', 'total',
      'items.id', 'items.variant_id', 'items.product_id', 'items.title',
      'items.variant_title', 'items.unit_price', 'items.quantity', 'items.total',
      'shipping_methods.id', 'promotions.code',
    ],
    filters: { id: cartId },
  })
  const cart = data[0]
  if (!cart || cart.currency_code !== 'vnd' || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'CART_CONTEXT_INVALID')
  }
  const cartItems = (cart.items ?? []).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const variantIds = cartItems.map((item) => item.variant_id)
    .filter((id): id is string => Boolean(id))
  const availability = variantIds.length ? await getVariantAvailability(query, {
    variant_ids: variantIds, sales_channel_id: channelId,
  }) : {}
  const items = cartItems.map((item) => ({
    lineId: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    title: item.title,
    variantLabel: item.variant_title,
    unitPriceVnd: integerAmount(item.unit_price),
    quantity: item.quantity,
    totalVnd: integerAmount(item.total),
    available: Boolean(item.variant_id && (availability[item.variant_id]?.availability ?? 0) > 0),
  }))
  const subtotalVnd = integerAmount(cart.subtotal)
  const discountVnd = integerAmount(cart.discount_total)
  const taxVnd = integerAmount(cart.tax_total)
  const totalVnd = integerAmount(cart.total)
  const shippingVnd = cart.shipping_methods?.length
    ? integerAmount(cart.shipping_total) : null
  const promotionCodes = (cart.promotions ?? [])
    .map((promotion) => promotion?.code)
    .filter((code): code is string => Boolean(code))
    .sort()
  const canonical = JSON.stringify({
    id: cart.id, updatedAt: cart.updated_at, subtotalVnd, discountVnd, shippingVnd,
    taxVnd, totalVnd, promotionCodes,
    items: [...items].sort((a, b) => a.lineId.localeCompare(b.lineId)),
  })
  return {
    revision: createHash('sha256').update(canonical).digest('hex'),
    currency: 'vnd', items, promotionCodes, subtotalVnd, discountVnd, shippingVnd, taxVnd, totalVnd,
    canCheckout: false, warnings: [],
  }
}
