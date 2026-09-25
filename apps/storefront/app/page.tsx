const demoProducts = [
  { title: 'Desk mat tối giản', price: '189.000đ', category: 'Bàn làm việc' },
  { title: 'Khay gom dây', price: '129.000đ', category: 'Gọn dây' },
  { title: 'Giá đỡ laptop gỗ', price: '279.000đ', category: 'Công thái học' },
];

export default function HomePage() {
  return <main className="shell">
    <header className="header"><a className="logo" href="/">Bàn Gọn</a><nav><a href="/san-pham">Sản phẩm</a><a href="/tu-van">Tư vấn chọn món</a><a href="/gio-hang">Giỏ hàng (0)</a></nav></header>
    <section className="hero"><p className="eyebrow">SHOP DEMO · VND · COD THỬ NGHIỆM</p><h1>Góc bàn gọn, đầu óc nhẹ hơn.</h1><p>Phụ kiện nhỏ giúp bạn làm việc thoải mái và dễ tập trung hơn.</p><a className="button" href="/san-pham">Xem sản phẩm</a></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">GỢI Ý KHỞI ĐẦU</p><h2>Mấy món dễ hợp với bàn nhỏ</h2></div><a href="/san-pham">Xem tất cả →</a></div><div className="grid">{demoProducts.map((product) => <article className="card" key={product.title}><div className="product-image" aria-hidden="true">{product.category}</div><p className="muted">{product.category}</p><h3>{product.title}</h3><strong>{product.price}</strong></article>)}</div></section>
    <footer className="footer">Bản demo nội bộ — chưa mở bán, chưa nhận đơn thật.</footer>
  </main>;
}
