import { normalizeCatalogText, selectCatalog, type CatalogSource } from '../../src/search/catalog'

function source(index: number, overrides: Partial<CatalogSource> = {}): CatalogSource {
  return {
    id: String(index),
    handle: 'tham-ban-' + index,
    title: 'Thảm bàn ' + index,
    categoryKey: 'desk-mat',
    thumbnail: null,
    searchTags: ['small'],
    createdAt: '2026-09-01T00:00:00Z',
    published: true,
    channelAllowed: true,
    demo: true,
    variants: [{ id: 'v-' + index, color: 'black', priceVnd: 199000, available: true }],
    ...overrides,
  }
}

describe('catalog full-set selection', () => {
  it('normalizes Vietnamese text without losing word boundaries', () => {
    expect(normalizeCatalogText('  Đèn   BÀN  ')).toBe('den ban')
  })

  it('filters the whole set before pagination and excludes drafts/wrong channel/no price', () => {
    const sources = Array.from({ length: 25 }, (_, index) => source(index))
    sources[0].published = false
    sources[1].channelAllowed = false
    sources[2].variants[0].priceVnd = null
    const result = selectCatalog(sources, { page: 2, limit: 12 })
    expect(result.total).toBe(22)
    expect(result.products).toHaveLength(10)
    expect(result.products[0].id).toBe('15')
  })

  it('requires the same buyable variant to match color and budget', () => {
    const product = source(1, {
      variants: [
        { id: 'cheap', color: 'black', priceVnd: 150000, available: false },
        { id: 'expensive', color: 'beige', priceVnd: 250000, available: true },
      ],
    })
    expect(selectCatalog([product], {
      page: 1, limit: 12, color: 'black', maxPriceVnd: 200000,
    }).total).toBe(0)
    expect(selectCatalog([product], {
      page: 1, limit: 12, color: 'beige', maxPriceVnd: 250000,
    }).products[0].availableColors).toEqual(['beige'])
  })
})
