'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, InlineError, LoadingSkeleton } from './ui-states'

type ProductImage = { url: string; alt: string }
type ProductVariant = {
  id: string
  sku: string | null
  options: { name: string; value: string }[]
  priceVnd: number | null
  available: boolean
  maxOrderQuantity: number
  thumbnail: string | null
}
type ProductDetailData = {
  id: string
  handle: string
  title: string
  description: string | null
  categoryKey: string | null
  images: ProductImage[]
  attributes: { key: string; label: string; value: string }[]
  demo: boolean
  variants: ProductVariant[]
}

const colorLabels: Record<string, string> = {
  black: 'Đen', gray: 'Xám', beige: 'Be', green: 'Xanh lá', white: 'Trắng', brown: 'Nâu',
}
const categoryLabels: Record<string, string> = {
  'desk-mat': 'Thảm bàn', 'laptop-stand': 'Giá đỡ laptop',
  'cable-organizer': 'Gọn dây', stationery: 'Văn phòng phẩm',
}

function colorLabel(variant: ProductVariant) {
  return variant.options.map(({ name, value }) =>
    name.toLowerCase() === 'color' ? colorLabels[value.toLowerCase()] ?? value : value
  ).join(' · ') || 'Mặc định'
}

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}

async function readJson(response: Response) {
  try { return await response.json() as Record<string, unknown> } catch { return {} }
}

async function getCsrfToken(): Promise<string> {
  const existing = await fetch('/api/v1/session', { cache: 'no-store' })
  if (existing.ok) {
    const result = await readJson(existing)
    const data = result.data as { csrfToken?: unknown } | undefined
    if (typeof data?.csrfToken === 'string') return data.csrfToken
  } else if (existing.status !== 404) {
    throw new Error('Không thể xác minh phiên mua hàng. Hãy thử lại sau ít phút.')
  }

  const created = await fetch('/api/v1/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  })
  const result = await readJson(created)
  const data = result.data as { csrfToken?: unknown } | undefined
  if (!created.ok || typeof data?.csrfToken !== 'string') {
    throw new Error('Chưa thể mở phiên mua hàng. Hãy thử lại.')
  }
  return data.csrfToken
}

export function ProductDetail({ handle }: { handle: string }) {
  const [product, setProduct] = useState<ProductDetailData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [quantity, setQuantity] = useState('1')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setProduct(null)
    setLoadError(false)
    setNotFound(false)
    setSelectedId('')
    setFeedback(null)
    setImageIndex(0)
    fetch(`/api/v1/products/${encodeURIComponent(handle)}`, {
      cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 404) {
        if (!controller.signal.aborted) setNotFound(true)
        return null
      }
      if (!response.ok) throw new Error('PRODUCT_UNAVAILABLE')
      const result = await readJson(response)
      if (!result.data || typeof result.data !== 'object') throw new Error('PRODUCT_BAD_RESPONSE')
      return result.data as ProductDetailData
    }).then((data) => {
      if (data && !controller.signal.aborted) setProduct(data)
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true)
    })
    return () => controller.abort()
  }, [handle, reload])

  const selected = product?.variants.find((variant) => variant.id === selectedId) ?? null
  const numericQuantity = /^\d+$/.test(quantity) ? Number(quantity) : Number.NaN
  const quantityValid = Number.isSafeInteger(numericQuantity) && numericQuantity >= 1 &&
    numericQuantity <= (selected?.maxOrderQuantity ?? 0)
  const activeImage = useMemo(() => {
    if (selected?.thumbnail) return { url: selected.thumbnail, alt: `${product?.title ?? ''} — ${colorLabel(selected)}` }
    return product?.images[imageIndex] ?? null
  }, [imageIndex, product, selected])

  async function addToCart() {
    if (!selected || !selected.available || !quantityValid || pending) return
    setPending(true)
    setFeedback(null)
    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-bg-csrf-token': csrfToken },
        body: JSON.stringify({ variantId: selected.id, quantity: numericQuantity }),
        cache: 'no-store',
      })
      if (response.status === 409) {
        setFeedback({ kind: 'error', text: 'Giá hoặc tình trạng còn hàng vừa thay đổi. Hãy kiểm tra lại lựa chọn trước khi thêm.' })
      } else if (!response.ok) {
        setFeedback({ kind: 'error', text: 'Chưa thêm được sản phẩm vào giỏ. Lựa chọn của bạn vẫn được giữ lại.' })
      } else {
        window.dispatchEvent(new Event('bg:cart-changed'))
        setFeedback({ kind: 'success', text: 'Đã thêm sản phẩm vào giỏ hàng.' })
      }
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Chưa thêm được sản phẩm vào giỏ.' })
    } finally {
      setPending(false)
    }
  }

  if (loadError) return <div className="container product-state"><InlineError message="Không tải được thông tin sản phẩm." onRetry={() => setReload((value) => value + 1)} /></div>
  if (notFound) return <div className="container product-state"><EmptyState title="Không tìm thấy sản phẩm" description="Sản phẩm có thể đã được gỡ khỏi catalog." actionHref="/san-pham" actionLabel="Quay lại sản phẩm" /></div>
  if (!product) return <div className="container product-state"><LoadingSkeleton label="Đang tải chi tiết sản phẩm" /></div>

  return <div className="container product-detail-page">
    <nav className="breadcrumbs" aria-label="Điều hướng vị trí"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><Link href="/san-pham">Sản phẩm</Link><span aria-hidden="true">/</span><span aria-current="page">{product.title}</span></nav>
    {product.demo ? <p className="product-demo-note">Sản phẩm và thông số bên dưới là dữ liệu demo tổng hợp.</p> : null}
    <div className="product-detail-layout">
      <section className="product-gallery" aria-label="Hình ảnh sản phẩm">
        <div className="product-gallery__main">
          {activeImage ? <img src={activeImage.url} alt={activeImage.alt} /> : <span>Chưa có ảnh sản phẩm</span>}
        </div>
        {product.images.length > 1 ? <div className="product-gallery__thumbs">{product.images.map((image, index) => <button type="button" key={image.url} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}><img src={image.url} alt="" /></button>)}</div> : null}
      </section>
      <section className="product-purchase" aria-labelledby="product-title">
        <p className="eyebrow">{product.categoryKey ? categoryLabels[product.categoryKey] ?? product.categoryKey : 'BÀN GỌN'}</p>
        <h1 id="product-title">{product.title}</h1>
        {selected?.priceVnd !== null && selected ? <p className="product-price">{money(selected.priceVnd!)}</p>
          : <p className="product-price">{selected ? 'Chưa có giá cho lựa chọn này' : 'Chọn một phiên bản để xem giá'}</p>}
        {product.description ? <p className="product-description">{product.description}</p> : null}
        {product.variants.length ? <fieldset className="variant-picker">
          <legend>Phiên bản{selected ? ` · ${colorLabel(selected)}` : ''}</legend>
          <div className="variant-options">{product.variants.map((variant) => (
            <label className={`variant-option${selectedId === variant.id ? ' is-selected' : ''}${!variant.available ? ' is-unavailable' : ''}`} key={variant.id}>
              <input type="radio" name="product-variant" value={variant.id} checked={selectedId === variant.id} onChange={() => {
                setSelectedId(variant.id)
                setFeedback(null)
              }} />
              <span className="variant-option__label">{colorLabel(variant)}</span>
              <span className="variant-option__price">{variant.priceVnd === null ? 'Chưa có giá' : money(variant.priceVnd)}</span>
              <span className="variant-option__stock">{variant.available ? 'Còn hàng' : 'Hết hàng'}</span>
            </label>
          ))}</div>
        </fieldset> : <p role="status">Sản phẩm chưa có phiên bản để đặt.</p>}
        {selected?.sku ? <p className="product-sku">Mã sản phẩm: {selected.sku}</p> : null}
        <div className="quantity-field"><label htmlFor="product-quantity">Số lượng</label><input id="product-quantity" type="number" min="1" max={selected?.maxOrderQuantity ?? 10} step="1" value={quantity} disabled={!selected} aria-describedby="quantity-help" onChange={(event) => setQuantity(event.target.value)} /><small id="quantity-help">{selected ? `Tối đa ${selected.maxOrderQuantity} sản phẩm cho lựa chọn này.` : 'Chọn phiên bản trước khi nhập số lượng.'}</small></div>
        {selected && !quantityValid ? <p className="field-error" role="status">Số lượng cần từ 1 đến {selected.maxOrderQuantity} cho phiên bản đang chọn.</p> : null}
        <button className="button add-to-cart" type="button" disabled={!selected || !selected.available || !quantityValid || pending} onClick={addToCart}>{pending ? 'Đang thêm…' : selected && !selected.available ? 'Tạm hết hàng' : 'Thêm vào giỏ'}</button>
        {feedback ? <p className={`cart-feedback cart-feedback--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}{feedback.kind === 'success' ? <> <Link href="/gio-hang">Xem giỏ hàng</Link></> : null}</p> : null}
        <p className="shipping-note">Phí giao hàng được tính theo địa chỉ ở bước thanh toán; chưa hiển thị ngày giao dự kiến.</p>
      </section>
    </div>
    {product.attributes.length ? <section className="product-specs"><details><summary>Thông số sản phẩm</summary><dl>{product.attributes.map((attribute) => <div key={attribute.key}><dt>{attribute.label}</dt><dd>{attribute.value}</dd></div>)}</dl></details></section> : null}
  </div>
}
