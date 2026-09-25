'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type CartSnapshot = {
  items: Array<{ lineId: string; title: string; quantity: number; totalVnd: number }>
  subtotalVnd: number
  discountVnd: number
  shippingVnd: number | null
  taxVnd: number
  totalVnd: number
}
type ShippingOption = { id: string; name: string; amountVnd: number; currencyCode: 'vnd'; priceType: 'flat' | 'calculated' }
type AddressForm = {
  firstName: string; lastName: string; phone: string; email: string; countryCode: 'vn'
  province: string; city: string; district: string; ward: string; address1: string; address2: string; postalCode: string
}
type Review = { reviewToken: string; expiresAt: string; cart: CartSnapshot }
const initialAddress: AddressForm = {
  firstName: '', lastName: '', phone: '', email: '', countryCode: 'vn', province: '', city: '',
  district: '', ward: '', address1: '', address2: '', postalCode: '',
}
const money = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(amount)

export function CheckoutView() {
  const [cart, setCart] = useState<CartSnapshot | null>(null)
  const [address, setAddress] = useState(initialAddress)
  const [options, setOptions] = useState<ShippingOption[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [review, setReview] = useState<Review | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/v1/cart', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (!active || !response.ok) return
      setCart(payload.data as CartSnapshot)
      if (!payload.data.items?.length) return
      const [addressResponse, optionsResponse] = await Promise.all([
        fetch('/api/v1/checkout/address', { cache: 'no-store' }),
        fetch('/api/v1/checkout/shipping-options', { cache: 'no-store' }),
      ])
      if (!active) return
      if (addressResponse.ok) {
        const saved = (await addressResponse.json()).data as { email: string; address: Partial<AddressForm> }
        setAddress({ ...initialAddress, ...saved.address, email: saved.email, countryCode: 'vn' })
        if (optionsResponse.ok) {
          const available = (await optionsResponse.json()).data.shippingOptions as ShippingOption[]
          setOptions(available)
        }
      }
    }).catch(() => { if (active) setError('Không tải được giỏ hàng.') })
    return () => { active = false }
  }, [])

  async function csrfToken() {
    const response = await fetch('/api/v1/session', { cache: 'no-store' })
    if (response.status === 404) {
      const created = await fetch('/api/v1/session', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', cache: 'no-store',
      })
      if (!created.ok) throw new Error('Không khởi tạo được phiên giỏ hàng.')
      return (await created.json()).data.csrfToken as string
    }
    if (!response.ok) throw new Error('Không xác minh được phiên giỏ hàng.')
    return (await response.json()).data.csrfToken as string
  }

  async function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice(''); setSelected(''); setReview(null)
    try {
      const csrf = await csrfToken()
      const response = await fetch('/api/v1/checkout/address', {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-bg-csrf-token': csrf },
        body: JSON.stringify({ email: address.email, address: {
          firstName: address.firstName, lastName: address.lastName, phone: address.phone,
          countryCode: address.countryCode, province: address.province, city: address.city,
          ...(address.district ? { district: address.district } : {}),
          ...(address.ward ? { ward: address.ward } : {}), address1: address.address1,
          ...(address.address2 ? { address2: address.address2 } : {}),
          ...(address.postalCode ? { postalCode: address.postalCode } : {}),
        } }), cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message ?? 'Chưa lưu được thông tin giao hàng.')
      setCart(payload.data.cart as CartSnapshot)
      setOptions(payload.data.shippingOptions as ShippingOption[])
      setNotice(payload.data.shippingOptions.length
        ? 'Địa chỉ đã lưu. Phí vận chuyển được báo từ hệ thống.'
        : 'Địa chỉ đã lưu nhưng hiện chưa có phương thức giao hàng phù hợp.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được thông tin giao hàng.')
    } finally { setBusy(false) }
  }

  async function chooseShipping(optionId: string) {
    setBusy(true); setError(''); setSelected(''); setReview(null)
    try {
      const csrf = await csrfToken()
      const response = await fetch('/api/v1/checkout/shipping', {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-bg-csrf-token': csrf },
        body: JSON.stringify({ optionId }), cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error('Phương thức vừa chọn không còn khả dụng. Hãy tải lại báo giá.')
      setCart(payload.data.cart as CartSnapshot)
      setSelected(optionId)
      setNotice('Phương thức vận chuyển đã được xác nhận lại từ hệ thống.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể chọn phương thức vận chuyển.')
    } finally { setBusy(false) }
  }

  async function createReview() {
    setBusy(true); setError(''); setNotice(''); setReview(null)
    try {
      const csrf = await csrfToken()
      const response = await fetch('/api/v1/checkout/review', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-bg-csrf-token': csrf },
        body: JSON.stringify({ method: 'cod' }), cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error('Giỏ hàng hoặc phí vận chuyển đã thay đổi. Hãy kiểm tra lại trước khi tiếp tục.')
      setReview(payload.data as Review)
      setCart(payload.data.cart as CartSnapshot)
      setNotice('Đã chốt bản xem lại COD trong 5 phút. Bạn cần xác nhận lại nếu thông tin giỏ thay đổi.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác minh bản xem lại đơn hàng.')
    } finally { setBusy(false) }
  }

  if (!cart) return <section className="checkout-state"><h1>Thông tin giao hàng</h1><p>Đang tải giỏ hàng…</p></section>
  if (!cart.items.length) return <section className="checkout-state"><h1>Thông tin giao hàng</h1><p>Giỏ hàng đang trống.</p><Link className="button" href="/san-pham">Chọn sản phẩm</Link></section>

  return <>
    <nav className="breadcrumbs" aria-label="Điều hướng vị trí"><Link href="/gio-hang">Giỏ hàng</Link><span aria-hidden="true">/</span><span aria-current="page">Thông tin giao hàng</span></nav>
    <p className="eyebrow">BƯỚC 1 · ĐỊA CHỈ VÀ VẬN CHUYỂN</p><h1>Thông tin giao hàng</h1>
    <p className="checkout-demo-note" role="note">Bản demo nội bộ: chưa đặt đơn hoặc gửi email thật. Nhập dữ liệu tổng hợp để thử quy trình.</p>
    <div className="checkout-layout">
      <form className="checkout-form" onSubmit={saveAddress}>
        <h2>Người nhận</h2>
        <label>Email<input type="email" autoComplete="email" required maxLength={254} value={address.email} onChange={(e) => setAddress({ ...address, email: e.target.value })} /></label>
        <div className="checkout-fields-two">
          <label>Tên<input autoComplete="given-name" required maxLength={80} value={address.firstName} onChange={(e) => setAddress({ ...address, firstName: e.target.value })} /></label>
          <label>Họ<input autoComplete="family-name" required maxLength={80} value={address.lastName} onChange={(e) => setAddress({ ...address, lastName: e.target.value })} /></label>
        </div>
        <label>Số điện thoại<input type="tel" autoComplete="tel" required minLength={8} maxLength={24} value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} /></label>
        <h2>Địa chỉ</h2>
        <label>Quốc gia<input value="Việt Nam" readOnly aria-readonly="true" /></label>
        <div className="checkout-fields-two"><label>Tỉnh / thành phố<input autoComplete="address-level1" required maxLength={100} value={address.province} onChange={(e) => setAddress({ ...address, province: e.target.value })} /></label><label>Thành phố / địa phương<input autoComplete="address-level2" required maxLength={100} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} /></label></div>
        <div className="checkout-fields-two"><label>Quận / huyện (nếu có)<input maxLength={100} value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} /></label><label>Phường / xã (nếu có)<input maxLength={100} value={address.ward} onChange={(e) => setAddress({ ...address, ward: e.target.value })} /></label></div>
        <label>Địa chỉ đường, số nhà<input autoComplete="street-address" required minLength={3} maxLength={180} value={address.address1} onChange={(e) => setAddress({ ...address, address1: e.target.value })} /></label>
        <div className="checkout-fields-two"><label>Thông tin thêm (không bắt buộc)<input maxLength={180} value={address.address2} onChange={(e) => setAddress({ ...address, address2: e.target.value })} /></label><label>Mã bưu chính (không bắt buộc)<input autoComplete="postal-code" maxLength={20} value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} /></label></div>
        <button className="button" type="submit" disabled={busy}>{busy ? 'Đang xác minh…' : 'Lưu địa chỉ và xem phí giao hàng'}</button>
      </form>
      <aside className="checkout-summary"><h2>Tóm tắt giỏ hàng</h2>{cart.items.map((item) => <p key={item.lineId}><span>{item.title} × {item.quantity}</span></p>)}
        <p><span>Tạm tính</span><strong>{money(cart.subtotalVnd)}</strong></p>{cart.discountVnd > 0 ? <p><span>Ưu đãi</span><strong>−{money(cart.discountVnd)}</strong></p> : null}
        <p><span>Vận chuyển</span><strong>{cart.shippingVnd === null ? 'Chưa xác định' : money(cart.shippingVnd)}</strong></p><p><span>Thuế</span><strong>{money(cart.taxVnd)}</strong></p><p className="cart-total"><span>Tổng hiện tại</span><strong>{money(cart.totalVnd)}</strong></p>
        {options.length ? <fieldset className="shipping-options"><legend>Chọn phương thức vận chuyển</legend>{options.map((option) => <label key={option.id}><input type="radio" name="shipping-option" value={option.id} checked={selected === option.id} disabled={busy} onChange={() => void chooseShipping(option.id)} /><span>{option.name}</span><strong>{money(option.amountVnd)}</strong></label>)}</fieldset> : null}
        {selected ? <button className="button checkout-continue" type="button" disabled={busy} onClick={() => void createReview()}>{busy ? 'Đang xác minh…' : 'Xem lại đơn COD'}</button> : null}
        {review ? <div className="checkout-state" role="status"><h3>Đơn đã được tính lại</h3><p>Thanh toán khi nhận hàng (COD)</p><p>Tổng xác nhận: <strong>{money(review.cart.totalVnd)}</strong></p><p>Mã xác minh có hiệu lực đến {new Date(review.expiresAt).toLocaleTimeString('vi-VN')}.</p><p>Chưa tạo đơn; bước xác nhận đặt hàng sẽ xuất hiện tiếp theo.</p></div> : null}
        <p className="checkout-next-note">Phí và tổng do Medusa tính. Xem lại chưa tạo đơn hoặc gửi email.</p>
      </aside>
    </div>
    {notice ? <p className="cart-feedback cart-feedback--success" role="status">{notice}</p> : null}
    {error ? <p className="cart-feedback cart-feedback--error" role="alert">{error}</p> : null}
  </>
}
