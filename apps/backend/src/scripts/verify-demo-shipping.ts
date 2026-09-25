import assert from 'node:assert/strict'
import type { ExecArgs, IPricingModuleService } from '@medusajs/framework/types'
import { BigNumber, ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils'
import {
  addShippingMethodToCartWorkflow,
  addToCartWorkflow,
  cancelOrderWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
  updateCartWorkflow,
} from '@medusajs/medusa/core-flows'
import { cartSnapshot } from '../cart/cart'

function amount(value: unknown): number {
  if (value instanceof BigNumber) return value.numeric
  if (typeof value === 'number') return value
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'Shipping amount is not numeric')
}

export default async function verifyDemoShipping({ container }: ExecArgs) {
  assert(['demo', 'test'].includes(process.env.APP_MODE ?? ''), 'Synthetic shipping test is local-only')
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: 'region', fields: ['id', 'name', 'currency_code', 'payment_providers.id'],
  })
  const region = regions.find((item) => item.name === 'Vietnam Demo')
  assert(region?.id && region.currency_code === 'vnd')
  assert(region.payment_providers?.some((provider) => provider?.id === 'pp_system_default'),
    'Manual payment provider must be registered in demo region')
  const { data: channels } = await query.graph({
    entity: 'sales_channel', fields: ['id', 'name'],
  })
  const channel = channels.find((item) => item.name === 'Bàn Gọn Storefront (Demo)')
  assert(channel?.id)
  const { data: variants } = await query.graph({
    entity: 'product_variant', fields: ['id', 'sku'],
    filters: { sku: 'BG-DEMO-01-BLACK' },
  })
  const variant = variants[0]
  assert(variant?.id)

  const { result: cart } = await createCartWorkflow(container).run({
    input: { region_id: region.id, sales_channel_id: channel.id },
  })
  await addToCartWorkflow(container).run({
    input: { cart_id: cart.id, items: [{ variant_id: variant.id, quantity: 1 }] },
  })
  await assert.rejects(updateCartWorkflow(container).run({
    input: {
      id: cart.id,
      shipping_address: { country_code: 'us', city: 'Unsupported Test City' },
    },
  }), 'Address outside Vietnam demo region must be rejected')
  await updateCartWorkflow(container).run({
    input: {
      id: cart.id,
      shipping_address: {
        first_name: 'Synthetic',
        last_name: 'Test',
        address_1: 'Demo street',
        city: 'Test City',
        country_code: 'vn',
      },
    },
  })
  const { result: options } = await listShippingOptionsForCartWithPricingWorkflow(container).run({
    input: { cart_id: cart.id },
  })
  const shippingOption = options.find((option) => option.name === 'Bàn Gọn Demo Standard Shipping')
  assert(shippingOption?.id, 'VN demo shipping option not eligible for cart')
  assert.equal(amount(shippingOption.amount), 30000, '199000 cart should quote 30000 shipping')
  const { data: persistedOptions } = await query.graph({
    entity: 'shipping_option',
    fields: ['id', 'price_set_link.price_set_id'],
    filters: { id: shippingOption.id },
  })
  const priceSetId = (persistedOptions[0] as { price_set_link?: {
    price_set_id?: string
  } })?.price_set_link?.price_set_id
  assert(priceSetId, 'Shipping option price set link missing')
  const pricing = container.resolve<IPricingModuleService>(Modules.PRICING)
  for (const [itemTotal, expectedShipping] of [[499999, 30000], [500000, 0]]) {
    const [calculated] = await pricing.calculatePrices(
      { id: [priceSetId] },
      { context: { currency_code: 'vnd', item_total: itemTotal } }
    )
    assert.equal(amount(calculated.calculated_amount), expectedShipping,
      'Shipping threshold mismatch for item_total=' + itemTotal)
  }
  await addShippingMethodToCartWorkflow(container).run({
    input: { cart_id: cart.id, options: [{ id: shippingOption.id }] },
  })
  const snapshot = await cartSnapshot(query, cart.id, channel.id)
  assert.equal(snapshot.subtotalVnd, 199000)
  assert.equal(snapshot.shippingVnd, 30000)
  assert.equal(snapshot.taxVnd, 0)
  assert.equal(snapshot.totalVnd, 229000)
  await updateCartWorkflow(container).run({
    input: { id: cart.id, email: 'synthetic-cod@invalid.example' },
  })
  const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
    input: { cart_id: cart.id, metadata: { synthetic_test: true } },
  })
  await createPaymentSessionsWorkflow(container).run({
    input: { payment_collection_id: collection.id, provider_id: 'pp_system_default' },
  })
  const { result: order } = await completeCartWorkflow(container).run({
    input: { id: cart.id },
  })
  assert(order?.id, 'COD cart did not become an order')
  try {
    const { data: collections } = await query.graph({
      entity: 'payment_collection',
      fields: ['id', 'status', 'authorized_amount', 'captured_amount',
        'payments.id', 'payments.captured_at'],
      filters: { id: collection.id },
    })
    const actual = collections[0]
    assert(actual, 'Order payment collection missing')
    assert.equal(amount(actual.captured_amount ?? 0), 0, 'COD must not be captured at placement')
    assert(!actual.payments?.some((payment) => payment?.captured_at),
      'COD payment has a capture timestamp')
    console.log('PASS demo shipping/COD: 199000+30000=229000; threshold 499999/500000; tax 0; order created without capture')
  } finally {
    await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })
    const { data: canceledOrders } = await query.graph({
      entity: 'order', fields: ['id', 'status', 'canceled_at'], filters: { id: order.id },
    })
    assert(canceledOrders[0]?.canceled_at, 'Synthetic order must be canceled after test')
  }
  const { data: reviewFixtureOrders } = await query.graph({
    entity: 'order', fields: ['id', 'canceled_at'], filters: { email: 'review-fixture@invalid.example' },
  })
  for (const fixture of reviewFixtureOrders) {
    if (!fixture.canceled_at) await cancelOrderWorkflow(container).run({ input: { order_id: fixture.id } })
  }
  const { data: remainingFixtures } = await query.graph({
    entity: 'order', fields: ['id', 'canceled_at'], filters: { email: 'review-fixture@invalid.example' },
  })
  assert(remainingFixtures.every((fixture) => Boolean(fixture.canceled_at)),
    'Synthetic checkout integration orders must be canceled, never deleted')
}
