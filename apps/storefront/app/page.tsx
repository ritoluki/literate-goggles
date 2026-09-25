import Link from 'next/link';
import { FeaturedProducts } from './components/catalog-view';

const featuredCategories = [
  ['desk-mat', 'Thảm bàn', 'Tạo mặt bàn gọn gàng'],
  ['laptop-stand', 'Giá đỡ laptop', 'Nâng màn hình vừa tầm'],
  ['cable-organizer', 'Gọn dây', 'Sắp xếp dây dễ tìm'],
  ['stationery', 'Văn phòng phẩm', 'Những món nhỏ cần thiết'],
] as const;

export default function HomePage() {
  return <div className="container">
    <section className="hero"><p className="eyebrow">SHOP DEMO · VND · COD THỬ NGHIỆM</p><h1>Góc bàn gọn, đầu óc nhẹ hơn.</h1><p>Phụ kiện nhỏ giúp bạn làm việc thoải mái và dễ tập trung hơn.</p><a className="button" href="/san-pham">Xem sản phẩm</a></section>
    <section className="section"><div className="section-heading"><div><p className="eyebrow">KHÁM PHÁ</p><h2>Chọn theo nhu cầu</h2></div></div><div className="category-grid">{featuredCategories.map(([key, title, description]) => <Link className="category-card" href={`/san-pham?category=${key}`} key={key}><strong>{title}</strong><span>{description}</span><span className="category-card__arrow" aria-hidden="true">→</span></Link>)}</div></section>
    <FeaturedProducts />
  </div>;
}
