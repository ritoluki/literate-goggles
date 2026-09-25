'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const categories = [
  { href: '/san-pham?category=desk-mat', label: 'Thảm bàn' },
  { href: '/san-pham?category=laptop-stand', label: 'Giá đỡ laptop' },
  { href: '/san-pham?category=cable-organizer', label: 'Gọn dây' },
  { href: '/san-pham?category=stationery', label: 'Văn phòng phẩm' },
]

export function SiteHeader() {
  const menuButton = useRef<HTMLButtonElement>(null)
  const mobileDialog = useRef<HTMLDialogElement>(null)
  const categoryDetails = useRef<HTMLDetailsElement>(null)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    document.querySelector('.site-header')?.setAttribute('data-hydrated', 'true')
    function closeOnOutside(event: PointerEvent) {
      const details = categoryDetails.current
      if (details?.open && !details.contains(event.target as Node)) details.open = false
    }
    document.addEventListener('pointerdown', closeOnOutside)
    let sequence = 0
    const refreshCartCount = async () => {
      const current = ++sequence
      try {
        const response = await fetch('/api/v1/cart', { cache: 'no-store' })
        const payload = await response.json()
        if (response.ok && current === sequence) {
          setCartCount(Array.isArray(payload.data?.items)
            ? payload.data.items.reduce((sum: number, item: { quantity?: number }) =>
              sum + (Number.isSafeInteger(item.quantity) ? item.quantity! : 0), 0) : 0)
        }
      } catch { /* Keep the last known badge count. */ }
    }
    const onCartChanged = () => { void refreshCartCount() }
    void refreshCartCount()
    window.addEventListener('bg:cart-changed', onCartChanged)
    return () => {
      sequence++
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('bg:cart-changed', onCartChanged)
    }
  }, [])

  function openMenu() {
    mobileDialog.current?.showModal()
  }

  function closeMenu() {
    mobileDialog.current?.close()
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/" aria-label="Bàn Gọn — trang chủ">Bàn Gọn<span className="brand__dot">.</span></Link>
        <nav className="desktop-nav" aria-label="Điều hướng chính">
          <details className="nav-disclosure" ref={categoryDetails} onKeyDown={(event) => {
            if (event.key === 'Escape') {
              categoryDetails.current!.open = false
              categoryDetails.current?.querySelector('summary')?.focus()
            }
          }}>
            <summary>Danh mục</summary>
            <div className="nav-disclosure__panel">
              {categories.map((category) => <Link key={category.href} href={category.href} onClick={() => {
                if (categoryDetails.current) categoryDetails.current.open = false
              }}>{category.label}</Link>)}
            </div>
          </details>
          <Link href="/san-pham">Tất cả sản phẩm</Link>
          <span className="nav-pending" aria-disabled="true">Tư vấn <small>sắp có</small></span>
        </nav>
        <div className="header-actions">
          <Link className="header-action" href="/san-pham" aria-label="Tìm sản phẩm">Tìm</Link>
          <Link className="header-action" href="/gio-hang" aria-label={`Giỏ hàng${cartCount ? `, ${cartCount} sản phẩm` : ''}`}>Giỏ{cartCount ? <span className="cart-badge" aria-hidden="true">{cartCount > 99 ? '99+' : cartCount}</span> : null}</Link>
          <button className="menu-toggle" type="button" ref={menuButton} onClick={openMenu} aria-label="Mở menu">Menu</button>
        </div>
      </div>
      <dialog className="mobile-drawer" ref={mobileDialog} aria-label="Menu điều hướng" onClose={() => menuButton.current?.focus()} onClick={(event) => {
        if (event.target === mobileDialog.current) closeMenu()
      }}>
        <div className="mobile-drawer__top"><strong>Bàn Gọn</strong><button type="button" onClick={closeMenu} aria-label="Đóng menu">Đóng</button></div>
        <nav className="mobile-drawer__nav" aria-label="Điều hướng di động">
          <Link href="/" onClick={closeMenu}>Trang chủ</Link>
          <Link href="/san-pham" onClick={closeMenu}>Tất cả sản phẩm</Link>
          <p>Danh mục</p>
          {categories.map((category) => <Link className="mobile-drawer__subcategory" key={category.href} href={category.href} onClick={closeMenu}>{category.label}</Link>)}
          <span aria-disabled="true">Tư vấn — sắp có</span>
          <Link href="/gio-hang" onClick={closeMenu}>Giỏ hàng{cartCount ? ` (${cartCount})` : ''}</Link>
        </nav>
      </dialog>
    </header>
  )
}
