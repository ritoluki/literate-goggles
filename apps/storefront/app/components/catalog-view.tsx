'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { EmptyState, InlineError, LoadingSkeleton } from './ui-states'

type ProductCard = {
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

type CatalogPayload = { products: ProductCard[]; total: number; page: number; limit: number }

const categories = [
  ['desk-mat', 'Thảm bàn'],
  ['laptop-stand', 'Giá đỡ laptop'],
  ['cable-organizer', 'Gọn dây'],
  ['stationery', 'Văn phòng phẩm'],
] as const

const colors = [
  ['black', 'Đen'], ['gray', 'Xám'], ['beige', 'Be'],
  ['green', 'Xanh lá'], ['white', 'Trắng'], ['brown', 'Nâu'],
] as const

const categoryLabels = new Map<string, string>(categories)

function parsePayload(value: unknown): CatalogPayload {
  if (!value || typeof value !== 'object' || !('data' in value)) throw new Error('CATALOG_BAD_RESPONSE')
  const data = value.data
  if (!data || typeof data !== 'object' || !('products' in data) || !Array.isArray(data.products) ||
    !('total' in data) || !Number.isSafeInteger(data.total) ||
    !('page' in data) || !Number.isSafeInteger(data.page) ||
    !('limit' in data) || !Number.isSafeInteger(data.limit)) throw new Error('CATALOG_BAD_RESPONSE')
  return data as CatalogPayload
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function useCatalog(url: string) {
  const [payload, setPayload] = useState<CatalogPayload | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    setPayload(null)
    fetch(`/api/v1/catalog${url ? `?${url}` : ''}`, {
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('CATALOG_UNAVAILABLE')
      return parsePayload(await response.json())
    }).then((next) => {
      if (!controller.signal.aborted) setPayload(next)
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [url, retry])

  return { payload, error, retry: () => setRetry((value) => value + 1) }
}

function ProductGrid({ products }: { products: ProductCard[] }) {
  return <div className="grid product-grid">{products.map((product) => (
    <article className="card" key={product.id}>
      <Link className="product-card-link" href={`/san-pham/${encodeURIComponent(product.handle)}`}>
        <div className="product-image">
          {product.thumbnail
            // Medusa image hosts vary by installation; use the catalog-provided URL until image hosts are allowlisted.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={product.thumbnail} alt="" loading="lazy" />
            : <span>Ảnh minh họa</span>}
        </div>
        <p className="muted">{categoryLabels.get(product.categoryKey) ?? product.categoryKey}</p>
        <h3>{product.title}</h3>
        <strong>{product.priceRangeVnd.min === product.priceRangeVnd.max
          ? formatPrice(product.priceRangeVnd.min)
          : `Từ ${formatPrice(product.priceRangeVnd.min)}`}</strong>
      </Link>
      <p className="product-card-meta">
        <span>{product.inStock ? 'Còn hàng' : 'Tạm hết hàng'}</span>
        {product.availableColors.length ? <span>{product.availableColors.length} màu</span> : null}
        {product.demo ? <span>Dữ liệu demo</span> : null}
      </p>
    </article>
  ))}</div>
}

export function FeaturedProducts() {
  const { payload, error, retry } = useCatalog('limit=8')
  return <section className="section">
    <div className="section-heading"><div><p className="eyebrow">GỢI Ý KHỞI ĐẦU</p><h2>Sản phẩm từ catalog cửa hàng</h2></div><Link href="/san-pham">Xem tất cả →</Link></div>
    {error ? <InlineError message="Chưa tải được sản phẩm. Catalog vẫn đang được giữ nguyên, không hiển thị như danh sách trống." onRetry={retry} />
      : payload ? payload.products.length ? <ProductGrid products={payload.products} />
        : <EmptyState title="Chưa có sản phẩm để gợi ý" description="Hãy quay lại catalog để thử tìm sản phẩm khác." actionHref="/san-pham" actionLabel="Mở catalog" />
        : <LoadingSkeleton label="Đang tải sản phẩm nổi bật" />}
  </section>
}

function FilterChips({
  params,
  remove,
}: {
  params: URLSearchParams
  remove: (key: string) => void
}) {
  const labels: [string, string][] = []
  const q = params.get('q')
  const category = params.get('category')
  const color = params.get('color')
  const minimum = params.get('minPriceVnd')
  const maximum = params.get('maxPriceVnd')
  if (q) labels.push(['q', `Từ khóa: ${q}`])
  if (category) labels.push(['category', categoryLabels.get(category) ?? category])
  if (color) labels.push(['color', colors.find(([key]) => key === color)?.[1] ?? color])
  if (minimum) labels.push(['minPriceVnd', `Từ ${formatPrice(Number(minimum))}`])
  if (maximum) labels.push(['maxPriceVnd', `Đến ${formatPrice(Number(maximum))}`])
  if (params.get('inStock') === 'true') labels.push(['inStock', 'Còn hàng'])
  if (!labels.length) return null
  return <div className="active-filters" aria-label="Bộ lọc đang áp dụng">
    {labels.map(([key, label]) => <button key={key} type="button" onClick={() => remove(key)}>{label}<span aria-hidden="true"> ×</span><span className="sr-only">, bỏ bộ lọc</span></button>)}
  </div>
}

export function CatalogExplorer({ initialQuery }: { initialQuery: string }) {
  const [queryString, setQueryString] = useState(initialQuery)
  const params = useMemo(() => new URLSearchParams(queryString), [queryString])
  const [queryInput, setQueryInput] = useState(params.get('q') ?? '')
  const details = useRef<HTMLDetailsElement>(null)
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { payload, error, retry } = useCatalog(queryString)

  useEffect(() => {
    function restoreFromHistory() {
      setQueryString(new URLSearchParams(window.location.search).toString())
    }
    window.addEventListener('popstate', restoreFromHistory)
    return () => window.removeEventListener('popstate', restoreFromHistory)
  }, [])

  useEffect(() => setQueryInput(params.get('q') ?? ''), [params])

  const updateUrl = useCallback((changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(queryString)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    if (resetPage && !('page' in changes)) next.delete('page')
    const suffix = next.toString()
    window.history.pushState(null, '', suffix ? `/san-pham?${suffix}` : '/san-pham')
    setQueryString(suffix)
  }, [queryString])

  useEffect(() => {
    if (queryInput.trim() === (params.get('q') ?? '')) return
    queryTimer.current = setTimeout(() => updateUrl({ q: queryInput.trim() || null }), 300)
    return () => { if (queryTimer.current) clearTimeout(queryTimer.current) }
  }, [queryInput, params, updateUrl])

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    updateUrl({
      category: String(form.get('category') || '') || null,
      color: String(form.get('color') || '') || null,
      minPriceVnd: String(form.get('minPriceVnd') || '') || null,
      maxPriceVnd: String(form.get('maxPriceVnd') || '') || null,
      inStock: form.get('inStock') ? 'true' : null,
    })
    if (details.current) details.current.open = false
  }

  function removeFilter(key: string) { updateUrl({ [key]: null }) }
  const currentPage = Number(params.get('page') ?? '1')
  const pages = payload ? Math.max(1, Math.ceil(payload.total / payload.limit)) : 1
  const filterCount = ['category', 'color', 'minPriceVnd', 'maxPriceVnd'].filter((key) => params.has(key)).length +
    (params.get('inStock') === 'true' ? 1 : 0)

  return <div className="catalog-page">
    <header className="catalog-heading"><p className="eyebrow">BÀN GỌN · SHOP DEMO</p><h1>Sản phẩm</h1>
      <p>Tìm phụ kiện phù hợp với góc làm việc của bạn.</p></header>
    <div className="catalog-toolbar">
      <label className="catalog-search">Tìm sản phẩm
        <input type="search" value={queryInput} maxLength={100} placeholder="Ví dụ: gọn dây, bàn nhỏ" onChange={(event) => setQueryInput(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (queryTimer.current) clearTimeout(queryTimer.current)
            updateUrl({ q: queryInput.trim() || null })
          }
        }} />
      </label>
      <label className="catalog-sort">Sắp xếp
        <select value={params.get('sort') ?? 'relevance'} onChange={(event) => updateUrl({ sort: event.target.value === 'relevance' ? null : event.target.value })}>
          <option value="relevance">Phù hợp</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option><option value="newest">Mới nhất</option>
        </select>
      </label>
    </div>
    <FilterChips params={params} remove={removeFilter} />
    <div className="catalog-layout">
      <details className="catalog-filters" ref={details} key={queryString} onKeyDown={(event) => {
        if (event.key === 'Escape' && details.current?.open) {
          details.current.open = false
          details.current.querySelector('summary')?.focus()
        }
      }} onClick={(event) => {
        if (event.target === details.current && details.current?.open) {
          details.current.open = false
          details.current.querySelector('summary')?.focus()
        }
      }}>
        <summary>Lọc sản phẩm{filterCount ? <span className="filter-count">{filterCount}</span> : null}</summary>
        <form className="filter-form" onSubmit={submitFilters}>
          <button className="filter-close" type="button" onClick={() => {
            if (details.current) {
              details.current.open = false
              details.current.querySelector('summary')?.focus()
            }
          }}>Đóng bộ lọc</button>
          <label>Danh mục<select name="category" defaultValue={params.get('category') ?? ''}><option value="">Tất cả danh mục</option>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Màu sắc<select name="color" defaultValue={params.get('color') ?? ''}><option value="">Tất cả màu</option>{colors.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <fieldset><legend>Khoảng giá (VND)</legend>
            <label>Từ<input name="minPriceVnd" type="number" min="0" max="50000000" step="1000" defaultValue={params.get('minPriceVnd') ?? ''} /></label>
            <label>Đến<input name="maxPriceVnd" type="number" min="0" max="50000000" step="1000" defaultValue={params.get('maxPriceVnd') ?? ''} /></label>
          </fieldset>
          <label className="stock-filter"><input name="inStock" type="checkbox" value="true" defaultChecked={params.get('inStock') === 'true'} /> Chỉ xem sản phẩm còn hàng</label>
          <button className="button" type="submit">Áp dụng bộ lọc</button>
          <Link className="clear-filters" href="/san-pham">Xóa tất cả bộ lọc</Link>
        </form>
      </details>
      <section className="catalog-results" aria-live="polite" aria-busy={!payload && !error}>
        {payload ? <p className="catalog-count">{payload.total} sản phẩm · Trang {payload.page} / {pages}</p> : null}
        {error ? <InlineError message="Không tải được catalog. Bộ lọc của bạn vẫn được giữ lại." onRetry={retry} />
          : payload ? payload.products.length ? <ProductGrid products={payload.products} />
            : <EmptyState title="Chưa tìm thấy sản phẩm" description="Hãy bỏ bớt một vài bộ lọc hoặc thử từ khóa khác." actionHref="/san-pham" actionLabel="Xóa bộ lọc" />
            : <LoadingSkeleton label="Đang tải catalog" />}
        {payload && payload.total > 0 ? <nav className="pagination" aria-label="Phân trang">
          <button type="button" disabled={currentPage <= 1} onClick={() => updateUrl({ page: String(currentPage - 1) }, false)}>Trang trước</button>
          <span>Trang {payload.page} / {pages}</span>
          <button type="button" disabled={currentPage >= pages} onClick={() => updateUrl({ page: String(currentPage + 1) }, false)}>Trang sau</button>
        </nav> : null}
      </section>
    </div>
  </div>
}
