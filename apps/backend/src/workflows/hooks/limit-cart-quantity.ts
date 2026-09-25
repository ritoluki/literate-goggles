import { addToCartWorkflow } from '@medusajs/medusa/core-flows'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import type { RemoteQueryFunction } from '@medusajs/framework/types'

type Query = Omit<RemoteQueryFunction, symbol>

// The core workflow holds the cart lock before this hook runs.
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const requested = new Map<string, number>()
  for (const item of input.items ?? []) {
    if (!item.variant_id || typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 || item.quantity > 10) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'INVALID_CART_QUANTITY')
    }
    requested.set(item.variant_id, (requested.get(item.variant_id) ?? 0) + item.quantity)
  }
  const query = container.resolve<Query>(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'cart',
    fields: ['id', 'items.variant_id', 'items.quantity'],
    filters: { id: input.cart_id },
  })
  for (const item of data[0]?.items ?? []) {
    if (item?.variant_id && requested.has(item.variant_id)) {
      requested.set(item.variant_id, (requested.get(item.variant_id) ?? 0) + (item.quantity ?? 0))
    }
  }
  if ([...requested.values()].some((quantity) => quantity > 10)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'CART_QUANTITY_LIMIT')
  }
})
