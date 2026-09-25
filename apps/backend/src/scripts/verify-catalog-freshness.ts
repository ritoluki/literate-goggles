import assert from 'node:assert/strict'
import type { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { updateProductsWorkflow } from '@medusajs/medusa/core-flows'
import { loadCatalogSources } from '../search/load-catalog'

export default async function verifyCatalogFreshness({ container }: ExecArgs) {
  assert.equal(process.env.APP_MODE, 'demo', 'This test may only mutate synthetic demo data')
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [{ data: products }, { data: regions }, { data: channels }] = await Promise.all([
    query.graph({
      entity: 'product',
      fields: ['id', 'title', 'metadata'],
      filters: { handle: 'tham-ban-co-ban' },
    }),
    query.graph({ entity: 'region', fields: ['id', 'name'] }),
    query.graph({ entity: 'sales_channel', fields: ['id', 'name'] }),
  ])
  const product = products[0]
  const region = regions.find((item) => item.name === 'Vietnam Demo')
  const channel = channels.find((item) => item.name === 'Bàn Gọn Storefront (Demo)')
  assert(product?.id && product.title && product.metadata?.fixture === 'catalog.seed.json')
  assert(region?.id && channel?.id)
  const originalTitle = product.title
  const changedTitle = originalTitle + ' [catalog-freshness-test]'

  try {
    await updateProductsWorkflow(container).run({
      input: { products: [{ id: product.id, title: changedTitle }] },
    })
    const changed = await loadCatalogSources(query, region.id, channel.id)
    assert.equal(changed.find((item) => item.id === product.id)?.title, changedTitle)
  } finally {
    await updateProductsWorkflow(container).run({
      input: { products: [{ id: product.id, title: originalTitle }] },
    })
  }
  const restored = await loadCatalogSources(query, region.id, channel.id)
  assert.equal(restored.find((item) => item.id === product.id)?.title, originalTitle)
  logger.info('Catalog freshness verified after product workflow update and safe restore.')
}
