import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  CatalogQueryError,
  parseCatalogFilters,
  selectCatalog,
} from '../../../search/catalog'
import { loadCatalogSources } from '../../../search/load-catalog'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  let filters
  try {
    filters = parseCatalogFilters(req.originalUrl ?? req.url)
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return res.status(400).json({ error: { code: 'INVALID_CATALOG_QUERY', message: error.message } })
    }
    throw error
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const keyChannels = req.publishable_key_context?.sales_channel_ids ?? []
  try {
    const [{ data: regions }, { data: channels }] = await Promise.all([
      query.graph({ entity: 'region', fields: ['id', 'name', 'currency_code'] }),
      query.graph({ entity: 'sales_channel', fields: ['id', 'name'] }),
    ])
    const region = process.env.CATALOG_REGION_ID
      ? regions.find((item) => item.id === process.env.CATALOG_REGION_ID)
      : process.env.APP_MODE === 'demo'
        ? regions.find((item) => item.name === 'Vietnam Demo')
        : undefined
    const channel = process.env.CATALOG_SALES_CHANNEL_ID
      ? channels.find((item) => item.id === process.env.CATALOG_SALES_CHANNEL_ID)
      : process.env.APP_MODE === 'demo'
        ? channels.find((item) => item.name === 'Bàn Gọn Storefront (Demo)')
        : undefined
    if (!region?.id || region.currency_code !== 'vnd' || !channel?.id) {
      return res.status(503).json({ error: { code: 'CATALOG_CONTEXT_UNAVAILABLE' } })
    }
    if (!keyChannels.includes(channel.id)) {
      return res.status(403).json({ error: { code: 'CATALOG_CHANNEL_FORBIDDEN' } })
    }

    const sources = await loadCatalogSources(query, region.id, channel.id)
    const catalog = selectCatalog(sources, filters)
    return res.json({ ...catalog, limit: filters.limit })
  } catch {
    return res.status(503).json({ error: { code: 'CATALOG_UNAVAILABLE' } })
  }
}
