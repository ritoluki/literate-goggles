import assert from 'node:assert/strict'
import type { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { loadCatalogSources } from '../search/load-catalog'
import { selectCatalog } from '../search/catalog'

export default async function verifyCatalogAdapter({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [{ data: regions }, { data: channels }] = await Promise.all([
    query.graph({ entity: 'region', fields: ['id', 'name', 'currency_code'] }),
    query.graph({ entity: 'sales_channel', fields: ['id', 'name'] }),
  ])
  const region = regions.find((item) => item.name === 'Vietnam Demo')
  const channel = channels.find((item) => item.name === 'Bàn Gọn Storefront (Demo)')
  assert(region?.id && region.currency_code === 'vnd')
  assert(channel?.id)

  const sources = await loadCatalogSources(query, region.id, channel.id)
  assert.equal(sources.length, 21, 'Only published products in the demo channel may be loaded')
  assert.equal(sources.flatMap((item) => item.variants).length, 42)
  assert(sources.every((item) => item.published && item.channelAllowed))
  assert(sources.flatMap((item) => item.variants).every((variant) =>
    ['black', 'gray', 'beige', 'green', 'white', 'brown'].includes(variant.color)
  ))

  const differentlyPriced = sources.find((item) => item.variants.some((a) =>
    a.available && a.priceVnd !== null && item.variants.some((b) =>
      b.available && b.priceVnd !== null && b.priceVnd < a.priceVnd!
    )
  ))
  assert(differentlyPriced, 'Fixture must include differently priced buyable color variants')
  const expensive = differentlyPriced.variants.find((a) => a.available && a.priceVnd !== null &&
    differentlyPriced.variants.some((b) => b.available && b.priceVnd !== null && b.priceVnd < a.priceVnd!)
  )
  assert(expensive?.priceVnd !== null && expensive?.priceVnd !== undefined)
  assert.equal(selectCatalog([differentlyPriced], {
    page: 1, limit: 12, color: expensive.color, maxPriceVnd: expensive.priceVnd - 1,
  }).total, 0, 'More expensive color must not pass a cheaper budget')

  const page = selectCatalog(sources, { page: 1, limit: 12 })
  assert(page.total > 0 && page.total <= 21)
  assert(page.products.every((item) => Number.isSafeInteger(item.priceRangeVnd.min)))
  assert(page.products.every((item) => item.priceRangeVnd.min <= item.priceRangeVnd.max))
  logger.info(
    `Catalog adapter verified: sources=${sources.length}, eligible=${page.total}, pageSize=${page.products.length}.`
  )
}
