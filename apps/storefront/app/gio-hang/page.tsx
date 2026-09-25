import type { Metadata } from 'next'
import { CartView } from '../components/cart-view'

export const metadata: Metadata = { title: 'Giỏ hàng | Bàn Gọn' }

export default function CartPage() {
  return <div className="container cart-page"><CartView /></div>
}
