import assert from "node:assert/strict"

import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  getVariantAvailability,
  ProductStatus,
  QueryContext,
} from "@medusajs/framework/utils"

const DEMO_CHANNEL_NAME = "Bàn Gọn Storefront (Demo)"
const DEMO_LOCATION_NAME = "Bàn Gọn Demo Warehouse"
const DEMO_REGION_NAME = "Vietnam Demo"
const DEMO_API_KEY_TITLE = "Bàn Gọn Demo Storefront Key"

type ContextVariant = {
  id: string
  manage_inventory: boolean
  allow_backorder: boolean
  calculated_price?: { calculated_amount: number | null; currency_code: string | null } | null
}

export default async function verifyCommerceContext({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const [{ data: regions }, { data: channels }, { data: locations }, { data: keys }] = await Promise.all([
    query.graph({ entity: "region", fields: ["id", "name", "currency_code", "countries.iso_2"] }),
    query.graph({ entity: "sales_channel", fields: ["id", "name"] }),
    query.graph({ entity: "stock_location", fields: ["id", "name", "sales_channels.id"] }),
    query.graph({ entity: "api_key", fields: ["id", "title", "sales_channels.id"] }),
  ])

  const region = regions.find((item) => item.name === DEMO_REGION_NAME)
  const channel = channels.find((item) => item.name === DEMO_CHANNEL_NAME)
  const location = locations.find((item) => item.name === DEMO_LOCATION_NAME)
  const publishableKey = keys.find((item) => item.title === DEMO_API_KEY_TITLE)

  assert(region, "Vietnam demo region must exist")
  assert.equal(region.currency_code, "vnd")
  assert(region.countries?.some((country) => country?.iso_2?.toLowerCase() === "vn"))
  assert(channel, "Demo sales channel must exist")
  assert(location, "Demo stock location must exist")
  assert(location.sales_channels?.some((item) => item?.id === channel.id))
  assert(publishableKey, "Demo publishable API key must exist")
  assert(publishableKey.sales_channels?.some((item) => item?.id === channel.id))

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "status",
      "metadata",
      "sales_channels.id",
      "variants.id",
      "variants.sku",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.calculated_price.*",
      "variants.inventory_items.inventory_item_id",
    ],
    filters: {
      status: ProductStatus.PUBLISHED,
    },
    context: {
      variants: {
        calculated_price: QueryContext({
          region_id: region.id,
          currency_code: "vnd",
        }),
      },
    },
  })

  const fixtureProducts = products.filter((product) =>
    product.metadata?.fixture === "catalog.seed.json" &&
    product.sales_channels?.some((item) => item?.id === channel.id)
  )
  const variants = fixtureProducts.flatMap((product) => product.variants ?? []) as ContextVariant[]
  const pricedVariants = variants.filter((variant) => variant.calculated_price?.calculated_amount != null)
  const variantIds = variants.map((variant) => variant.id).filter((id): id is string => Boolean(id))
  const availability = await getVariantAvailability(query, {
    variant_ids: variantIds,
    sales_channel_id: channel.id,
  })

  assert.equal(fixtureProducts.length, 21, "Only 21 published storefront fixture products should match")
  assert.equal(variants.length, 42, "Published storefront fixture products should expose 42 variants")
  assert(pricedVariants.length > 0, "At least one variant must have a calculated VND price")
  assert(pricedVariants.every((variant) => variant.calculated_price?.currency_code === "vnd"))
  assert(variants.every((variant) => variant.manage_inventory && !variant.allow_backorder))
  assert(variantIds.every((id) => id in availability))
  assert(Object.values(availability).some((item) => (item.availability ?? 0) > 0))

  logger.info(
    `Commerce context verified: region=vnd, products=${fixtureProducts.length}, variants=${variants.length}, availability=${Object.keys(availability).length}.`
  )
}
