import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

type FixtureVariant = {
  sku: string
  options: Record<string, string>
  priceVnd: number | null
  manageInventory: boolean
  allowBackorder: boolean
  inventoryQuantity: number
}

type FixtureProduct = {
  seedKey: string
  handle: string
  title: string
  description: string
  status: "published" | "draft"
  categoryKey: string
  salesChannelKeys: string[]
  thumbnail: string | null
  images: { url: string }[]
  metadata: Record<string, unknown>
  variants: FixtureVariant[]
}

type CatalogFixture = {
  schemaVersion: number
  kind: string
  notForLiveImport: boolean
  products: FixtureProduct[]
}

const DEMO_CHANNEL_NAME = "Bàn Gọn Storefront (Demo)"
const DEMO_LOCATION_NAME = "Bàn Gọn Demo Warehouse"
const DEMO_REGION_NAME = "Vietnam Demo"
const DEMO_API_KEY_TITLE = "Bàn Gọn Demo Storefront Key"
const categoryName = (key: string) => key.split("-")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ")

export default async function seedDemoProducts({ container }: ExecArgs) {
  if (!['demo', 'test', 'staging'].includes(process.env.APP_MODE ?? '')) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED,
      'Demo seed requires APP_MODE=demo|test|staging; live and unset mode are forbidden.')
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fixturePath = resolve(process.cwd(), "../../fixtures/catalog.seed.json")
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as CatalogFixture

  if (fixture.schemaVersion !== 1 || fixture.kind !== 'synthetic-demo-fixture' || fixture.notForLiveImport !== true) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unsupported catalog fixture schema: ${fixture.schemaVersion}`)
  }

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })
  const store = stores[0]
  if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No Medusa store exists. Run medusa db:migrate first.")

  const existingCurrencies = (store.supported_currencies ?? [])
    .map((currency) => currency?.currency_code)
    .filter((currency): currency is string => Boolean(currency))
  const currencies = [...new Set([...existingCurrencies, "vnd"])]
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: currencies.map((currency_code) => ({
          currency_code,
          is_default: currency_code === "vnd",
          is_tax_inclusive: false,
        })),
      },
    },
  })

  const { data: existingChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  let demoChannelId = existingChannels.find((channel) => channel.name === DEMO_CHANNEL_NAME)?.id
  if (!demoChannelId) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{
        name: DEMO_CHANNEL_NAME,
        description: "Synthetic local-only Bàn Gọn demo catalog",
      }] },
    })
    demoChannelId = result[0].id
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  })
  if (!regions.some((region) => region.name === DEMO_REGION_NAME)) {
    await createRegionsWorkflow(container).run({
      input: { regions: [{
        name: DEMO_REGION_NAME,
        currency_code: "vnd",
        countries: ["vn"],
        payment_providers: ["pp_system_default"],
      }] },
    })
  }

  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })
  if (!taxRegions.some((region) => region.country_code?.toLowerCase() === "vn")) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "vn", provider_id: "tp_system" }],
    })
  }

  const { data: apiKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title"],
  })
  if (!apiKeys.some((key) => key.title === DEMO_API_KEY_TITLE)) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{
        title: DEMO_API_KEY_TITLE,
        type: "publishable",
        created_by: "",
      }] },
    })
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: result[0].id, add: [demoChannelId] },
    })
  }

  const { data: existingLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  let demoLocationId = existingLocations.find((location) => location.name === DEMO_LOCATION_NAME)?.id
  let createdLocation = false
  if (!demoLocationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: { locations: [{
        name: DEMO_LOCATION_NAME,
        address: { city: "Ho Chi Minh City", country_code: "VN", address_1: "Demo only" },
      }] },
    })
    demoLocationId = result[0].id
    createdLocation = true
  }

  if (!demoChannelId || !demoLocationId) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Failed to create the demo sales channel or stock location.")
  }
  if (createdLocation) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: demoLocationId },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: demoLocationId, add: [demoChannelId] },
    })
  }

  const categoryKeys = [...new Set(fixture.products.map((product) => product.categoryKey))]
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const missingCategoryKeys = categoryKeys.filter(
    (key) => !existingCategories.some((category) => category.handle === key)
  )
  if (missingCategoryKeys.length) {
    await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingCategoryKeys.map((key) => ({
        name: categoryName(key),
        handle: key,
        is_active: true,
      })) },
    })
  }

  const { data: allCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const categoryIds = new Map(allCategories.map((category) => [category.handle, category.id]))
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No shipping profile exists. Run medusa db:migrate first.")

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["handle"],
  })
  const existingHandles = new Set(existingProducts.map((product) => product.handle))
  const { data: existingDetails } = await query.graph({
    entity: 'product',
    fields: ['handle', 'metadata', 'variants.sku'],
    pagination: { skip: 0, take: 1000 },
  })
  const byHandle = new Map(existingDetails.map((product) => [product.handle, product]))
  const skuOwners = new Map(existingDetails.flatMap((product) =>
    (product.variants ?? []).filter((variant) => variant?.sku)
      .map((variant) => [variant!.sku!, product.handle] as const)
  ))
  for (const product of fixture.products) {
    const existing = byHandle.get(product.handle)
    if (existing) {
      const actualSkus = new Set((existing.variants ?? []).map((variant) => variant?.sku))
      if (existing.metadata?.seed_key !== product.seedKey ||
        actualSkus.size !== product.variants.length ||
        product.variants.some((variant) => !actualSkus.has(variant.sku))) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA,
          'Existing demo handle conflicts with fixture; refusing to overwrite catalog or stock.')
      }
    } else if (product.variants.some((variant) => skuOwners.has(variant.sku))) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA,
        'A fixture SKU is already owned by another product; refusing partial seed.')
    }
  }
  const productsToCreate = fixture.products.filter((product) => !existingHandles.has(product.handle))

  if (productsToCreate.length) {
    await createProductsWorkflow(container).run({
      input: {
        products: productsToCreate.map((product) => {
          const colorValues = [...new Set(product.variants.map((variant) => variant.options.color))]
          const categoryId = categoryIds.get(product.categoryKey)
          if (!categoryId) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Missing category ${product.categoryKey}`)
          return {
            title: product.title,
            handle: product.handle,
            description: product.description,
            status: product.status === "published" ? ProductStatus.PUBLISHED : ProductStatus.DRAFT,
            category_ids: [categoryId],
            shipping_profile_id: shippingProfile.id,
            thumbnail: product.thumbnail,
            images: product.images,
            metadata: { ...product.metadata, seed_key: product.seedKey, fixture: "catalog.seed.json" },
            options: [{ title: "Color", values: colorValues }],
            variants: product.variants.map((variant) => ({
              title: variant.options.color,
              sku: variant.sku,
              manage_inventory: variant.manageInventory,
              allow_backorder: variant.allowBackorder,
              options: { Color: variant.options.color },
              prices: variant.priceVnd === null ? [] : [{
                currency_code: "vnd",
                amount: variant.priceVnd,
              }],
            })),
            sales_channels: product.salesChannelKeys.includes("storefront-demo")
              ? [{ id: demoChannelId }]
              : [],
          }
        }),
      },
    })
  }

  const quantityBySku = new Map(fixture.products.flatMap((product) =>
    product.variants.map((variant) => [variant.sku, variant.inventoryQuantity] as const)
  ))
  const fixtureHandles = new Set(fixture.products.map((product) => product.handle))
  const { data: seededProducts } = await query.graph({
    entity: "product",
    fields: ["handle", "variants.sku", "variants.inventory_items.inventory_item_id"],
  })
  const { data: existingLevels } = await query.graph({
    entity: 'inventory_level',
    fields: ['inventory_item_id', 'location_id'],
    pagination: { skip: 0, take: 1000 },
  })
  const existingLevelKeys = new Set(existingLevels.map((level) =>
    [level.inventory_item_id, level.location_id].join(':')
  ))
  const inventoryLevels = seededProducts
    .filter((product) => fixtureHandles.has(product.handle))
    .flatMap((product) => product.variants ?? [])
    .filter((variant) => Boolean(variant?.sku))
    .flatMap((variant) => (variant.inventory_items ?? [])
      .filter((inventoryItem) => Boolean(inventoryItem?.inventory_item_id))
      .filter((inventoryItem) => !existingLevelKeys.has(
        [inventoryItem!.inventory_item_id, demoLocationId].join(':')
      ))
      .map((inventoryItem) => ({
        location_id: demoLocationId,
        inventory_item_id: inventoryItem!.inventory_item_id!,
        stocked_quantity: quantityBySku.get(variant.sku!) ?? 0,
      })))
  if (inventoryLevels.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: inventoryLevels },
    })
  }

  logger.info(
    `Bàn Gọn demo seed complete: ${productsToCreate.length} product(s) created, ${fixture.products.length - productsToCreate.length} already present.`
  )
}
