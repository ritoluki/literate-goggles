import Link from 'next/link'

export function EnvironmentBanner() {
  return <div className="environment-banner" role="note">Bản demo nội bộ · Chưa mở bán, chưa nhận đơn thật</div>
}

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="container site-footer__inner">
      <div><strong>Bàn Gọn</strong><p>Gọn góc bàn, nhẹ ngày làm việc.</p></div>
      <nav aria-label="Điều hướng chân trang"><Link href="/">Trang chủ</Link><Link href="/san-pham">Sản phẩm</Link></nav>
      <p className="site-footer__note">Nội dung và sản phẩm hiện là dữ liệu minh họa. Chưa có giao dịch thật.</p>
    </div>
  </footer>
}
