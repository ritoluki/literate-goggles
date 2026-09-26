import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  addShippingMethodToCartWorkflow,
  addToCartWorkflow,
  cancelOrderWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
  updateCartWorkflow,
  updateInventoryLevelsWorkflow,
} from '@medusajs/medusa/core-flows'
import { cartSnapshot } from '../cart/cart'
import { createReviewToken } from '../checkout/review-token'
import { completeCheckoutWorkflow } from '../workflows/complete-checkout'

export default async function verifyInventoryRace({ container }: ExecArgs) {
  assert(['demo', 'test'].includes(process.env.APP_MODE ?? ''), 'Inventory race test is local-only')
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({ entity: 'region', fields: ['id', 'name'], filters: { name: 'Vietnam Demo' } })
  const { data: channels } = await query.graph({ entity: 'sales_channel', fields: ['id', 'name'],
    filters: { name: 'Bàn Gọn Storefront (Demo)' } })
  const { data: variants } = await query.graph({ entity: 'product_variant', fields: [
    'id', 'sku', 'inventory_items.inventory_item_id', 'manage_inventory', 'allow_backorder',
  ], filters: { sku: 'BG-DEMO-01-BLACK' } })
  const region = regions[0]
  const channel = channels[0]
  const variant = variants[0]
  assert(region?.id && channel?.id && variant?.id, 'Demo region/channel/stock fixture is required')
  assert(process.env.REVIEW_TOKEN_SECRET && process.env.REVIEW_TOKEN_SECRET.length >= 32,
    'Review token secret must be configured for checkout race verification')
  assert(variant.manage_inventory && !variant.allow_backorder, 'Race fixture must enforce finite inventory')
  const itemIds = (variant.inventory_items ?? []).map((item) => item?.inventory_item_id)
    .filter((id: string | undefined): id is string => Boolean(id))
  assert(itemIds.length, 'Race variant must link to an inventory item')
  const { data: levels } = await query.graph({ entity: 'inventory_level', fields: [
    'id', 'inventory_item_id', 'location_id', 'stocked_quantity', 'reserved_quantity',
  ], filters: { inventory_item_id: itemIds }, pagination: { skip: 0, take: 100 } })
  const level = levels.find((candidate: { stocked_quantity: number; reserved_quantity: number }) =>
    candidate.stocked_quantity >= 1 && candidate.reserved_quantity === 0)
  assert(level, 'Race fixture requires one stocked level with no outstanding reservations')
  const originalStock = level.stocked_quantity
  const runId = randomUUID()
  let stockChanged = false
  const orderIds = new Set<string>()

  try {
    await updateInventoryLevelsWorkflow(container).run({ input: { updates: [{
      id: level.id, inventory_item_id: level.inventory_item_id, location_id: level.location_id, stocked_quantity: 1,
    }] } })
    stockChanged = true

    const prepareCart = async (suffix: string) => {
      const { result: cart } = await createCartWorkflow(container).run({ input: {
        region_id: region.id, sales_channel_id: channel.id,
      } })
      await addToCartWorkflow(container).run({ input: {
        cart_id: cart.id, items: [{ variant_id: variant.id, quantity: 1 }],
      } })
      await updateCartWorkflow(container).run({ input: {
        id: cart.id, email: `inventory-race-${runId}-${suffix}@invalid.example`, shipping_address: {
          first_name: 'Synthetic', last_name: 'Race', address_1: 'Local test fixture',
          city: 'Test City', province: 'Demo', country_code: 'vn',
        },
      } })
      const { result: options } = await listShippingOptionsForCartWithPricingWorkflow(container).run({
        input: { cart_id: cart.id },
      })
      const option = options.find((item: { name: string }) => item.name === 'Bàn Gọn Demo Standard Shipping')
      assert(option?.id, 'Demo shipping option must be eligible for the race cart')
      await addShippingMethodToCartWorkflow(container).run({ input: {
        cart_id: cart.id, options: [{ id: option.id }],
      } })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cart.id, metadata: { synthetic_inventory_race: true } },
      })
      await createPaymentSessionsWorkflow(container).run({ input: {
        payment_collection_id: collection.id, provider_id: 'pp_system_default',
      } })
      const { data: hydrated } = await query.graph({ entity: 'cart', filters: { id: cart.id }, fields: [
        'id', 'shipping_methods.id', 'payment_collection.payment_sessions.id',
      ] })
      const shippingId = hydrated[0]?.shipping_methods?.[0]?.id
      const paymentSessionId = hydrated[0]?.payment_collection?.payment_sessions?.[0]?.id
      assert(shippingId && paymentSessionId, 'Race cart must have shipping and COD payment session')
      const snapshot = await cartSnapshot(query, cart.id, channel.id)
      const sessionId = `inventory-race-session-${runId}-${suffix}`
      const token = createReviewToken({ sid: sessionId, cid: cart.id, fingerprint: snapshot.revision,
        total: snapshot.totalVnd, currency: 'vnd', shipping: shippingId, payment: 'cod',
        paymentSession: paymentSessionId }).token
      return { id: cart.id as string, sessionId, token }
    }

    const carts = await Promise.all([prepareCart('a'), prepareCart('b')])
    const outcomes = await Promise.allSettled(carts.map((cart) => completeCheckoutWorkflow(container).run({
      input: { cart_id: cart.id, session_id: cart.sessionId, channel_id: channel.id,
        idempotency_key: `inventory-race-key-${cart.sessionId}`, review_token: cart.token },
    })))
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected')
    for (const failure of failures) console.error(`Checkout race request rejected: ${String(failure.reason?.message ?? failure.reason)}`)
    const { data: raceOrders } = await query.graph({ entity: 'order', fields: ['id'], filters: {
      email: { $in: [`inventory-race-${runId}-a@invalid.example`, `inventory-race-${runId}-b@invalid.example`] },
    } })
    for (const order of raceOrders) orderIds.add(order.id)
    assert.equal(orderIds.size, 1,
      'Two simultaneous carts competing for the last unit must create exactly one Medusa order')
    console.log('PASS inventory race: two COD carts competed for one unit; exactly one order completed')
  } finally {
    for (const orderId of orderIds) {
      try { await cancelOrderWorkflow(container).run({ input: { order_id: orderId } }) } catch { /* already canceled */ }
    }
    if (stockChanged) {
      await updateInventoryLevelsWorkflow(container).run({ input: { updates: [{
        id: level.id, inventory_item_id: level.inventory_item_id, location_id: level.location_id,
        stocked_quantity: originalStock,
      }] } })
      const { data: restored } = await query.graph({ entity: 'inventory_level', fields: ['stocked_quantity'],
        filters: { id: level.id } })
      assert.equal(restored[0]?.stocked_quantity, originalStock,
        'Synthetic inventory fixture must restore its original stocked quantity')
    }
  }
}
