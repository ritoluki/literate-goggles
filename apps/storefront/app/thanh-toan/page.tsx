import type { Metadata } from 'next'
import { CheckoutView } from '../components/checkout-view'

export const metadata: Metadata = { title: 'Thông tin giao hàng | Bàn Gọn' }

export default function CheckoutPage() {
  return <div className="container checkout-page"><CheckoutView /></div>
}
