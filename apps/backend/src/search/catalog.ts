export type CatalogVariant = {
  id: string
  color: string
  priceVnd: number | null
  available: boolean
}

export type CatalogSource = {
  id: string
  handle: string
  title: string
  categoryKey: string
  thumbnail: string | null
  searchTags: string[]
  createdAt: string
  published: boolean
  channelAllowed: boolean
  demo: boolean
  variants: CatalogVariant[]
}

export type CatalogFilters = {
  q?: string
  category?: string
  color?: string
  minPriceVnd?: number
  maxPriceVnd?: number
  inStock?: boolean
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
  page: number
  limit: number
}

export type CatalogCard = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  categoryKey: string
  priceRangeVnd: { min: number; max: number }
  inStock: boolean
  availableColors: string[]
  demo: boolean
}

const CATEGORIES = new Set(['desk-mat', 'laptop-stand', 'cable-organizer', 'stationery'])
const COLORS = new Set(['black', 'gray', 'beige', 'green', 'white', 'brown'])
const SORTS = new Set(['relevance', 'price_asc', 'price_desc', 'newest'])
const KEYS = new Set([
  'q', 'category', 'color', 'minPriceVnd', 'maxPriceVnd',
  'inStock', 'sort', 'page', 'limit',
])

export class CatalogQueryError extends Error {}

export function parseCatalogFilters(url: string): CatalogFilters {
  const params = new URL(url, 'http://localhost').searchParams
  for (const key of params.keys()) {
    if (!KEYS.has(key) || params.getAll(key).length !== 1) {
      throw new CatalogQueryError('Unknown or repeated catalog parameter')
    }
  }
  const integer = (key: string, fallback: number, min: number, max: number): number => {
    const raw = params.get(key)
    if (raw === null) return fallback
    if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new CatalogQueryError('Invalid ' + key)
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new CatalogQueryError('Invalid ' + key)
    }
    return value
  }
  const q = params.get('q')?.trim()
  if (q && q.length > 100) throw new CatalogQueryError('Query is too long')
  const category = params.get('category') ?? undefined
  if (category && !CATEGORIES.has(category)) throw new CatalogQueryError('Invalid category')
  const color = params.get('color') ?? undefined
  if (color && !COLORS.has(color)) throw new CatalogQueryError('Invalid color')
  const sort = params.get('sort') ?? 'relevance'
  if (!SORTS.has(sort)) throw new CatalogQueryError('Invalid sort')
  const inStockRaw = params.get('inStock')
  if (inStockRaw !== null && inStockRaw !== 'true' && inStockRaw !== 'false') {
    throw new CatalogQueryError('Invalid inStock')
  }
  const minPriceVnd = params.has('minPriceVnd')
    ? integer('minPriceVnd', 0, 0, 50_000_000) : undefined
  const maxPriceVnd = params.has('maxPriceVnd')
    ? integer('maxPriceVnd', 0, 0, 50_000_000) : undefined
  if (minPriceVnd !== undefined && maxPriceVnd !== undefined && minPriceVnd > maxPriceVnd) {
    throw new CatalogQueryError('Price range is reversed')
  }
  return {
    q, category, color, minPriceVnd, maxPriceVnd,
    inStock: inStockRaw === 'true',
    sort: sort as CatalogFilters['sort'],
    page: integer('page', 1, 1, 1_000_000),
    limit: integer('limit', 12, 1, 48),
  }
}

export function normalizeCatalogText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

export function selectCatalog(
  sources: CatalogSource[],
  filters: CatalogFilters
): { products: CatalogCard[]; total: number; page: number } {
  const tokens = normalizeCatalogText(filters.q ?? '').split(' ').filter(Boolean)
  const matches: { card: CatalogCard; sortPrice: number; createdAt: string }[] = []

  for (const source of sources) {
    if (!source.published || !source.channelAllowed) continue
    if (filters.category && source.categoryKey !== filters.category) continue
    const searchText = normalizeCatalogText(
      [source.title, source.handle, source.categoryKey, ...source.searchTags].join(' ')
    )
    if (!tokens.every((token) => searchText.includes(token))) continue

    const priced = source.variants.filter((variant) =>
      variant.priceVnd !== null &&
      Number.isSafeInteger(variant.priceVnd) &&
      variant.priceVnd >= 0
    )
    if (!priced.length) continue
    const buyable = priced.filter((variant) => variant.available)
    if (filters.inStock && !buyable.length) continue
    const matching = buyable.filter((variant) =>
      (!filters.color || variant.color === filters.color) &&
      (filters.minPriceVnd === undefined || variant.priceVnd! >= filters.minPriceVnd) &&
      (filters.maxPriceVnd === undefined || variant.priceVnd! <= filters.maxPriceVnd)
    )
    if ((filters.color || filters.minPriceVnd !== undefined ||
      filters.maxPriceVnd !== undefined) && !matching.length) continue

    const prices = priced.map((variant) => variant.priceVnd!)
    matches.push({
      card: {
        id: source.id,
        handle: source.handle,
        title: source.title,
        thumbnail: source.thumbnail,
        categoryKey: source.categoryKey,
        priceRangeVnd: { min: Math.min(...prices), max: Math.max(...prices) },
        inStock: buyable.length > 0,
        availableColors: [...new Set(buyable.map((variant) => variant.color))],
        demo: source.demo,
      },
      sortPrice: Math.min(...(matching.length ? matching : buyable.length ? buyable : priced)
        .map((variant) => variant.priceVnd!)),
      createdAt: source.createdAt,
    })
  }

  const sort = filters.sort ?? 'relevance'
  if (sort === 'price_asc') matches.sort((a, b) => a.sortPrice - b.sortPrice)
  if (sort === 'price_desc') matches.sort((a, b) => b.sortPrice - a.sortPrice)
  if (sort === 'newest') matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const offset = (filters.page - 1) * filters.limit
  return {
    products: matches.slice(offset, offset + filters.limit).map(({ card }) => card),
    total: matches.length,
    page: filters.page,
  }
}
