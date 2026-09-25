'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

type CartItem = {
  lineId: string
  productId: string
  variantId: string
  title: string
  variantLabel: string | null
  unitPriceVnd: number
  quantity: number
  totalVnd: number
  available: boolean
}
type Cart = {
  revision: string
  items: CartItem[]
  promotionCodes: string[]
  subtotalVnd: number
  discountVnd: number
  shippingVnd: number | null
  taxVnd: number
  totalVnd: number
}

const money = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(amount)

export function CartView() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const sequence = useRef(0)

  const refresh = useCallback(async () => {
    const requestSequence = ++sequence.current
    setError('')
    try {
      const response = await fetch('/api/v1/cart', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.data) throw new Error('Không tải được giỏ hàng. Vui lòng thử lại.')
      if (requestSequence === sequence.current) setCart(payload.data as Cart)
    } catch (cause) {
      if (requestSequence === sequence.current) {
        setError(cause instanceof Error ? cause.message : 'Không tải được giỏ hàng.')
      }
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function csrfToken() {
    const session = await fetch('/api/v1/session', { cache: 'no-store' })
    if (session.status === 404) {
      const created = await fetch('/api/v1/session', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', cache: 'no-store',
      })
      if (!created.ok) throw new Error('Không khởi tạo được phiên giỏ hàng.')
      return (await created.json()).data.csrfToken as string
    }
    if (!session.ok) throw new Error('Không xác minh được phiên giỏ hàng.')
    return (await session.json()).data.csrfToken as string
  }

  async function mutate(path: string, method: string, body?: object) {
    if (pending) return
    setPending(true)
    setNotice('')
    setError('')
    const mutationSequence = ++sequence.current
    try {
      const token = await csrfToken()
      const response = await fetch(path, {
        method,
        headers: { 'x-bg-csrf-token': token, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload.data) {
        throw new Error(response.status === 409 ? 'Mã ưu đãi không hợp lệ hoặc đã hết hạn.' : 'Chưa cập nhật được giỏ hàng.')
      }
      if (mutationSequence === sequence.current) {
        setCart(payload.data as Cart)
        setNotice('Giỏ hàng đã được cập nhật.')
        window.dispatchEvent(new Event('bg:cart-changed'))
      }
    } catch (cause) {
      if (mutationSequence === sequence.current) {
        setError(cause instanceof Error ? cause.message : 'Chưa cập nhật được giỏ hàng.')
      }
    } finally {
      setPending(false)
    }
  }

  if (!cart && !error) return <section className="cart-state" aria-live="polite"><h1>Giỏ hàng</h1><p>Đang tải giỏ hàng…</p></section>
  if (!cart && error) return <section className="cart-state"><h1>Giỏ hàng</h1><p className="cart-feedback cart-feedback--error" role="alert">{error}</p><button className="button" onClick={() => void refresh()}>Thử lại</button></section>

  return <>
    <nav className="breadcrumbs" aria-label="Điều hướng vị trí"><Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Giỏ hàng</span></nav>
    <h1>Giỏ hàng</h1>
    {cart!.items.length === 0 ? <section className="cart-empty"><h2>Giỏ hàng đang trống</h2><p>Chọn món đồ phù hợp để bắt đầu sắp xếp góc bàn của bạn.</p><Link className="button" href="/san-pham">Khám phá sản phẩm</Link></section> : <div className="cart-layout">
      <section className="cart-lines" aria-label="Sản phẩm trong giỏ">
        {cart!.items.map((item) => <article className="cart-line" key={item.lineId}>
          <div className="cart-line__info"><h2>{item.title}</h2>{item.variantLabel ? <p>{item.variantLabel}</p> : null}<p>{money(item.unitPriceVnd)} / món</p>{!item.available ? <p className="cart-feedback cart-feedback--error" role="status">Tình trạng còn hàng vừa thay đổi; vui lòng kiểm tra trước khi đặt.</p> : null}</div>
          <label>Số lượng <select aria-label={`Số lượng ${item.title}`} value={item.quantity} disabled={pending} onChange={(event) => void mutate(`/api/v1/cart/items/${item.lineId}`, 'PATCH', { quantity: Number(event.target.value) })}>{Array.from({ length: 10 }, (_, index) => index + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <strong>{money(item.totalVnd)}</strong>
          <button type="button" className="cart-remove" disabled={pending} onClick={() => void mutate(`/api/v1/cart/items/${item.lineId}`, 'DELETE')}>Xóa</button>
        </article>)}
      </section>
      <aside className="cart-summary" aria-label="Tóm tắt đơn hàng">
        <h2>Tóm tắt</h2><p><span>Tạm tính</span><strong>{money(cart!.subtotalVnd)}</strong></p>
        {cart!.discountVnd > 0 ? <p><span>Ưu đãi</span><strong>−{money(cart!.discountVnd)}</strong></p> : null}
        <p><span>Vận chuyển</span><strong>{cart!.shippingVnd === null ? 'Tính ở bước tiếp theo' : money(cart!.shippingVnd)}</strong></p>
        <p><span>Thuế</span><strong>{money(cart!.taxVnd)}</strong></p><p className="cart-total"><span>Tổng hiện tại</span><strong>{money(cart!.totalVnd)}</strong></p>
        <form className="cart-promo" onSubmit={(event) => { event.preventDefault(); void mutate('/api/v1/cart/promotion', 'PUT', { code }) }}><label htmlFor="promotion-code">Mã ưu đãi</label><div><input id="promotion-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={32} /><button type="submit" disabled={pending || !code.trim()}>Áp dụng</button></div></form>
        {cart!.promotionCodes.map((promotion) => <p key={promotion}>Đang áp dụng: <strong>{promotion}</strong><button className="cart-remove" disabled={pending} onClick={() => void mutate('/api/v1/cart/promotion', 'DELETE')}>Gỡ mã</button></p>)}
        <p className="cart-checkout-note">Phí giao hàng và điều kiện đơn hàng sẽ được xác nhận ở bước tiếp theo.</p>
      </aside>
    </div>}
    {notice ? <p role="status" className="cart-feedback cart-feedback--success">{notice}</p> : null}
    {error ? <p role="alert" className="cart-feedback cart-feedback--error">{error}</p> : null}
    {pending ? <p role="status">Đang cập nhật…</p> : null}
  </>
}
