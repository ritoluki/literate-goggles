# 02. Đặc tả giao diện — không cần Figma trước

## 2.1 Hướng hình ảnh

Phong cách gọn, ấm, dễ mua; nền trắng ngà, chữ đậm rõ, ảnh sản phẩm lớn. Tránh dashboard hóa storefront, gradient nhiều màu, badge AI quá nổi hoặc animation cản mua hàng.

Tên demo “Bàn Gọn”; tagline “Gọn góc bàn, nhẹ ngày làm việc”. Đây là nội dung minh họa. Agent tự xây UI từ spec, không chờ chủ dự án vẽ Figma.

## 2.2 Design tokens chuẩn

| Token | Giá trị khởi đầu |
|---|---|
| background / surface | `#FAFAF7` / `#FFFFFF` |
| text / muted | `#17201B` / `#56625B` |
| primary / primary-hover | `#166534` / `#14532D` |
| border / danger | `#D8DED8` / `#B91C1C` |
| font | system sans; hỗ trợ tiếng Việt; không phụ thuộc tải font từ bên thứ ba |
| body / small | 16px / 14px; line-height 1.5 |
| h1 desktop/mobile | 40/32px, line-height 1.2 |
| content max width | 1200px; padding 16px mobile, 24px desktop |
| spacing | 4, 8, 12, 16, 24, 32, 48, 64px |
| radius | input 8px, card 12px, dialog 16px |
| focus | ring 2px dễ thấy, offset 2px |
| interactive target | tối thiểu 44×44px cho touch |

Đây là token đề xuất; kiểm tra contrast thực tế cho từng trạng thái, không suy rằng màu có sẵn tự đảm bảo accessibility. Có thể chỉnh để đạt tương phản, ghi ADR nếu thay nhiều.

Breakpoints triển khai: mobile dưới 768; tablet 768–1023; desktop từ 1024. Kiểm tra 360, 390, 768, 1280, 1440px, portrait và keyboard zoom 200%.

## 2.3 Header/footer

Desktop: logo trái; danh mục/tất cả/tư vấn ở giữa; tìm kiếm và giỏ ở phải. Dropdown mở bằng click/keyboard; hover có thể hỗ trợ nhưng không là cách duy nhất. Escape đóng, focus về trigger, click ngoài đóng.

Mobile: logo, nút tìm, giỏ; menu drawer trap focus. Không dùng sticky header chiếm hơn khoảng 72px; badge cập nhật qua server result.

Footer: nhóm chính sách, liên hệ, người bán ở live. Banner demo nằm ngay đầu trang và không được che bởi sticky element.

## 2.4 Trang chủ `/`

Thứ tự: banner môi trường → header → hero một CTA mua + một CTA tư vấn → 4 danh mục → 8 sản phẩm nổi bật → cách tư vấn hoạt động → footer.
Hero không gắn claim doanh thu/review giả. Ảnh demo dùng SVG tự tạo/placeholder có nhãn; ảnh bán thật do chủ shop cấp quyền. Không scrape ảnh shop khác.
Cards gồm ảnh 1:1, tên tối đa 2 dòng, giá “từ” khi khác giá variant, màu dạng text/chips, tình trạng và nút xem. Không “thêm ngay” variant tùy tiện.

## 2.5 Catalog `/san-pham`

Desktop: tiêu đề/count → search + sort → sidebar filter 240px + grid 3 cột. Mobile: grid 2 cột, filter bottom sheet với nút “Áp dụng”; số filter đang có.
Tìm kiếm debounce 300ms; Enter áp dụng ngay; hủy hoặc bỏ qua response cũ bằng request version. Query URL cập nhật nhất quán; đổi filter reset page 1. Loading skeleton không làm nhảy layout.
Empty state nêu tiêu chí gây hẹp; nút xóa bộ lọc. Error state có retry mà giữ state; không hiển thị “0 sản phẩm” khi API đang lỗi.

## 2.6 Product detail

Desktop 2 cột: ảnh 55%, thông tin mua 45%. Mobile xếp dọc; sticky CTA cuối màn chỉ xuất hiện khi không che nội dung/keyboard.
Variant màu là radio group có label; chọn màu update availability nhưng không xóa quantity âm thầm; quantity max theo rule UI và server.
Thông số trong accordion có keyboard; shipping chỉ hiển thị nguyên tắc/ước tính được cấu hình, không hứa ngày giao nếu chưa tích hợp.
Thêm thành công: thông báo live region + link xem giỏ; không tự điều hướng checkout. Nếu stock/giá đổi: thông báo và yêu cầu kiểm tra, không thêm một item khác.

## 2.7 Giỏ `/gio-hang`

Line ảnh/tên/variant/quantity/giá/xóa; summary gồm subtotal, discount, ship ước tính hoặc “Tính tại thanh toán”, tổng có chú thích.
Chỉnh quantity có pending riêng từng dòng; xóa hỏi bằng undo ngắn hoặc xác nhận, không modal cho mọi thao tác. Optimistic UI chỉ cho phần có thể rollback; tổng authoritative luôn từ backend.
Giỏ trống có CTA về catalog. “Thanh toán” disabled khi cart invalid, update pending hoặc checkout đang bảo trì.

## 2.8 Checkout `/thanh-toan`

Một trang chia 3 khu vực: thông tin nhận hàng → giao hàng/phương thức COD → kiểm tra và đặt.
Desktop form + summary sticky; mobile summary có thể mở rộng, tổng cuối luôn thấy. Label luôn hiện, placeholder không thay label; autofill đúng; email/phone keyboard phù hợp.
Hiển thị thông tin chính sách trước nút; consent marketing không xuất hiện v1. Không bắt checkbox “đồng ý tất cả” thay cho nội dung rõ.
Nút cuối hiển thị “Đặt hàng COD · [tổng]”; disabled khi thiếu address/shipping hoặc pending. Nếu outcome unknown: “Đang xác minh đơn đã tạo, không cần đặt lại”, poll trạng thái; không hiện failure khiến khách click tạo lần nữa.

## 2.9 Xác nhận `/don-hang/xac-nhan/[reference]`

Mã tham chiếu không phải secret. Quyền truy cập gắn với phiên server.
Header “Đã nhận đơn hàng”, không “Đã thanh toán” cho COD chưa thu tiền. Tóm tắt items/địa chỉ đã che một phần theo thiết kế; full address chỉ trong phần có quyền.
Nếu session không sở hữu: lỗi chung 404 hoặc trang không tìm thấy, không tiết lộ đơn có tồn tại. Không auto-fill PII qua URL.

## 2.10 Tư vấn `/tu-van`

Bên trái/trên: form category, ngân sách mỗi món, màu, mục đích và câu ngắn. Bên phải/dưới: tối đa 3 card.
Chips ví dụ: “Bàn nhỏ”, “Dễ mang theo”, “Tối giản”; ngưỡng ngân sách 100k/300k/500k/1 triệu và ô tự nhập.
Luôn hiện dòng “Ngân sách cho mỗi sản phẩm, chưa gồm phí giao hàng”. Input natural language được chuyển thành chip để người dùng kiểm tra. Khi không hiểu, hỏi bằng form/chips, không giả vờ trò chuyện linh hoạt.
States: idle → validating → retrieving → deciding → success/clarify/no-match/fallback.
Fallback copy: “Đang gợi ý theo bộ lọc của cửa hàng.” Không cần lỗi kỹ thuật làm người mua sợ; dashboard kỹ thuật vẫn ghi đúng nguyên nhân.
Mỗi gợi ý: variant, giá, 2–3 lý do grounded, CTA xem/thêm sau xác nhận variant. Không show xác suất như chất lượng sản phẩm.
Nút “Làm lại” xóa preferences phiên tư vấn, không xóa giỏ.

## 2.11 Bản đồ component

`SiteHeader`, `MobileNav`, `SearchBox`, `FilterPanel`, `ActiveFilterChips`, `ProductCard`, `Price`, `VariantSelector`, `QuantityInput`, `CartLine`, `CartSummary`, `AddressForm`, `ShippingOptions`, `OrderReview`, `AdvisorForm`, `RecommendationCard`, `InlineError`, `EmptyState`, `LoadingSkeleton`, `EnvironmentBanner`.

Components trình bày không biết provider Jev. Commerce state không duplicate trong nhiều global stores; ưu tiên server authority và một cart state boundary. Dùng native HTML trước component phức tạp.

## 2.12 Nghiệm thu hình ảnh

Agent lưu screenshot từng trang ở mobile và desktop, đi qua hover/focus/loading/error/empty/out-of-stock. Đánh giá no overflow, no clipped Vietnamese text, no layout shift mạnh, focus thấy được và không nút “chết”.
Không yêu cầu chủ dự án duyệt từng pixel; chỉ hỏi một lần trước đổi thương hiệu live. Mọi ảnh seed không được xuất hiện như ảnh hàng thật ở live.
