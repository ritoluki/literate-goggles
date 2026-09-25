import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { getVariantAvailability, ProductStatus, QueryContext } from '@medusajs/framework/utils'
import { safeProductImageUrl } from '../../../../products/images'

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_ORDER_QUANTITY = 10

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const result = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  return result ? result.slice(0, maxLength) : null
}

function productAttributes(metadata: Record<string, unknown> | null | undefined) {
  const attributes: { key: string; label: string; value: string }[] = []
  const material = safeText(metadata?.material, 80)
  if (material) attributes.push({ key: 'material', label: 'Chất liệu', value: material })
  const dimensions = metadata?.dimensions_mm
  if (Array.isArray(dimensions) && dimensions.length > 0 && dimensions.length <= 3 &&
    dimensions.every((part) => Number.isSafeInteger(part) && part > 0 && part <= 100_000)) {
    attributes.push({ key: 'dimensions', label: 'Kích thước', value: `${dimensions.join(' × ')} mm` })
  }
  const spaces = metadata?.space_fit
  if (Array.isArray(spaces) && spaces.length > 0 && spaces.length <= 4 &&
    spaces.every((space) => typeof space === 'string' && /^[a-z-]{1,30}$/.test(space))) {
    attributes.push({ key: 'space_fit', label: 'Không gian phù hợp', value: spaces.join(', ') })
  }
  return attributes
}

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const handle = req.params.handle
  if (!HANDLE.test(handle) || handle.length > 120) {
    return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND' } })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const keyChannels = req.publishable_key_context?.sales_channel_ids ?? []
    const [{ data: regions }, { data: channels }] = await Promise.all([
      query.graph({ entity: 'region', fields: ['id', 'name', 'currency_code'] }),
      query.graph({ entity: 'sales_channel', fields: ['id', 'name'] }),
    ])
    const region = process.env.CATALOG_REGION_ID
      ? regions.find((item) => item.id === process.env.CATALOG_REGION_ID)
      : process.env.APP_MODE === 'demo' ? regions.find((item) => item.name === 'Vietnam Demo') : undefined
    const channel = process.env.CATALOG_SALES_CHANNEL_ID
      ? channels.find((item) => item.id === process.env.CATALOG_SALES_CHANNEL_ID)
      : process.env.APP_MODE === 'demo'
        ? channels.find((item) => item.name === 'Bàn Gọn Storefront (Demo)') : undefined
    if (!region?.id || region.currency_code !== 'vnd' || !channel?.id) {
      return res.status(503).json({ error: { code: 'PRODUCT_CONTEXT_UNAVAILABLE' } })
    }
    if (!keyChannels.includes(channel.id)) {
      return res.status(403).json({ error: { code: 'PRODUCT_CHANNEL_FORBIDDEN' } })
    }

    const { data } = await query.graph({
      entity: 'product',
      fields: [
        'id', 'handle', 'title', 'description', 'thumbnail', 'images.*', 'metadata', 'status',
        'categories.handle', 'sales_channels.id',
        'variants.id', 'variants.sku', 'variants.thumbnail', 'variants.manage_inventory',
        'variants.allow_backorder', 'variants.options.value', 'variants.options.option.title',
        'variants.calculated_price.*',
      ],
      filters: { handle, status: ProductStatus.PUBLISHED },
      context: {
        variants: { calculated_price: QueryContext({ region_id: region.id, currency_code: 'vnd' }) },
      },
      pagination: { take: 1 },
    })
    const product = data[0]
    if (!product || product.status !== ProductStatus.PUBLISHED ||
      !product.sales_channels?.some((item) => item?.id === channel.id)) {
      return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND' } })
    }
    const variants = (product.variants ?? []).filter((variant) => Boolean(variant?.id))
    const availability = variants.length ? await getVariantAvailability(query, {
      variant_ids: variants.map((variant) => variant!.id!),
      sales_channel_id: channel.id,
    }) : {}
    const mappedVariants = variants.map((variant) => {
      const id = variant!.id!
      const calculated = (variant as typeof variant & {
        calculated_price?: { calculated_amount: number | null; currency_code: string | null }
      }).calculated_price
      const priceVnd = calculated?.currency_code === 'vnd' &&
        typeof calculated.calculated_amount === 'number' &&
        Number.isSafeInteger(calculated.calculated_amount) && calculated.calculated_amount >= 0
        ? calculated.calculated_amount : null
      const stock = availability[id]?.availability ?? 0
      const available = priceVnd !== null && (!variant!.manage_inventory ||
        Boolean(variant!.allow_backorder) || stock > 0)
      const options = (variant!.options ?? []).flatMap((option) => {
        const name = safeText(option?.option?.title, 60)
        const value = safeText(option?.value, 80)
        return name && value ? [{ name, value }] : []
      })
      return {
        id,
        sku: safeText(variant!.sku, 100),
        options,
        priceVnd,
        available,
        maxOrderQuantity: available
          ? Math.min(MAX_ORDER_QUANTITY, variant!.manage_inventory && !variant!.allow_backorder ? stock : MAX_ORDER_QUANTITY)
          : 0,
        thumbnail: safeProductImageUrl((variant as typeof variant & { thumbnail?: string | null }).thumbnail),
      }
    })
    const title = safeText(product.title, 240)
    if (!title || !product.id || !product.handle) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND' } })
    const images = (product.images ?? []).flatMap((image, index) => {
      const url = safeProductImageUrl(image?.url)
      if (!url) return []
      const alt = safeText((image as typeof image & { metadata?: Record<string, unknown> }).metadata?.alt, 160)
      return [{ url, alt: alt ?? `${title} — ảnh ${index + 1}` }]
    })
    const thumbnail = safeProductImageUrl(product.thumbnail)
    if (thumbnail && !images.some((image) => image.url === thumbnail)) {
      images.unshift({ url: thumbnail, alt: `${title} — ảnh sản phẩm` })
    }
    const metadata = product.metadata && typeof product.metadata === 'object'
      ? product.metadata as Record<string, unknown> : undefined
    const description = safeText(product.description, 10_000)
    const categoryKey = safeText(product.categories?.[0]?.handle, 60)
    return res.json({
      product: {
        id: product.id,
        handle: product.handle,
        title,
        description,
        categoryKey,
        images,
        attributes: productAttributes(metadata),
        demo: metadata?.fixture === 'catalog.seed.json',
        variants: mappedVariants,
      },
    })
  } catch {
    return res.status(503).json({ error: { code: 'PRODUCT_UNAVAILABLE' } })
  }
}
