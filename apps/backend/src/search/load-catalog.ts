import type { RemoteQueryFunction } from '@medusajs/framework/types'
import {
  getVariantAvailability,
  MedusaError,
  ProductStatus,
  QueryContext,
} from '@medusajs/framework/utils'
import type { CatalogSource, CatalogVariant } from './catalog'

const MAX_PRODUCTS = 1000
const PAGE_SIZE = 100

function tags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export async function loadCatalogSources(
  query: Omit<RemoteQueryFunction, symbol>,
  regionId: string,
  salesChannelId: string
): Promise<CatalogSource[]> {
  const products: CatalogSource[] = []
  for (let skip = 0; skip <= MAX_PRODUCTS; skip += PAGE_SIZE) {
    const { data, metadata } = await query.graph({
      entity: 'product',
      fields: [
        'id', 'handle', 'title', 'thumbnail', 'created_at', 'status', 'metadata',
        'categories.handle', 'sales_channels.id',
        'variants.id', 'variants.options.value', 'variants.options.option.title',
        'variants.manage_inventory', 'variants.allow_backorder',
        'variants.calculated_price.*',
      ],
      filters: { status: ProductStatus.PUBLISHED },
      context: {
        variants: {
          calculated_price: QueryContext({ region_id: regionId, currency_code: 'vnd' }),
        },
      },
      pagination: { skip, take: PAGE_SIZE },
    })
    if ((metadata?.count ?? 0) > MAX_PRODUCTS || skip + data.length > MAX_PRODUCTS) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'CATALOG_CAP_EXCEEDED')
    }

    const pageVariantIds = data
      .filter((product) => product.sales_channels?.some((channel) => channel?.id === salesChannelId))
      .flatMap((product) => product.variants ?? [])
      .map((variant) => variant?.id)
      .filter((id): id is string => Boolean(id))
    const availability = pageVariantIds.length ? await getVariantAvailability(query, {
      variant_ids: pageVariantIds,
      sales_channel_id: salesChannelId,
    }) : {}

    for (const product of data) {
      if (!product.sales_channels?.some((channel) => channel?.id === salesChannelId)) continue
      const categoryKey = product.categories?.[0]?.handle
      if (!product.id || !product.handle || !product.title || !categoryKey) continue
      const variants = (product.variants ?? []).filter((variant) => Boolean(variant?.id))
      const mappedVariants: CatalogVariant[] = variants.map((variant) => {
        const calculated = (variant as typeof variant & {
          calculated_price?: { calculated_amount: number | null; currency_code: string | null }
        }).calculated_price
        const amount = calculated?.currency_code === 'vnd'
          ? calculated.calculated_amount : null
        const color = variant!.options?.find((option) =>
          option?.option?.title?.toLowerCase() === 'color'
        )?.value ?? ''
        return {
          id: variant!.id!,
          color,
          priceVnd: typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0
            ? amount : null,
          available: !variant!.manage_inventory || Boolean(variant!.allow_backorder) ||
            (availability[variant!.id!]?.availability ?? 0) > 0,
        }
      })
      products.push({
        id: product.id,
        handle: product.handle,
        title: product.title,
        categoryKey,
        thumbnail: product.thumbnail ?? null,
        searchTags: [
          ...tags(product.metadata?.use_cases),
          ...tags(product.metadata?.styles),
        ],
        createdAt: String(product.created_at),
        published: product.status === ProductStatus.PUBLISHED,
        channelAllowed: true,
        demo: product.metadata?.fixture === 'catalog.seed.json',
        variants: mappedVariants,
      })
    }
    if (data.length < PAGE_SIZE) break
  }
  return products
}
