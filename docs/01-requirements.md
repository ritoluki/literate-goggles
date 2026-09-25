# 01. Yêu cầu chức năng và tiêu chí nghiệm thu

Mã FR dùng xuyên suốt backlog, tests và báo cáo. “AC” là điều kiện nghiệm thu, không phải gợi ý.

## FR-01 — Trang chủ và điều hướng
Trang chủ có header, tìm kiếm, danh mục, hero, nhóm sản phẩm và CTA “Tìm món phù hợp”. Footer có liên hệ/chính sách thật ở live; demo có nhãn rõ.
AC: mọi CTA dẫn đến trang hợp lệ; bàn phím dùng được; logo về trang chủ; cart badge đúng tổng số lượng; mobile không tràn ngang. Không fake review, số đơn hoặc đồng hồ đếm ngược.

## FR-02 — Catalog/search/filter/sort
Route `/san-pham` lưu filter trong query string. Cho phép từ khóa, category, màu, khoảng giá và chỉ còn hàng; sort phù hợp, giá tăng/giảm, mới nhất. Mặc định 12 sản phẩm/trang.
AC: lọc trên toàn bộ tập kết quả phù hợp, **không lọc sau khi chỉ tải trang đầu**; total/page đúng; refresh/back giữ filter; bỏ lọc từng chip; không có kết quả hiển thị cách sửa tiêu chí. Giá lọc gắn với biến thể có thể mua trong context hiện tại.

## FR-03 — Chi tiết sản phẩm
Route `/san-pham/[handle]` có ảnh, tên, giá, mô tả, thuộc tính, chọn variant, quantity, stock và thêm giỏ.
AC: chọn variant làm cập nhật giá/ảnh/availability; không tự thay variant khách đã chọn; nút disabled nếu chưa chọn đủ/stock hết/request đang gửi; không thấy draft hoặc sản phẩm ở sales channel khác. SKU/thuộc tính không được hallucinate.

## FR-04 — Giỏ hàng
Cart lưu server-side, nhận diện bằng cookie phiên HttpOnly. Hiển thị line item, variant, quantity, đơn giá, giảm giá, subtotal và ước tính phí nếu có.
AC: refresh/trở lại vẫn thấy giỏ; tăng/giảm/xóa đúng; request song song không mất cập nhật; thay giá hoặc hết stock được phản ánh rõ; không nhận amount từ FE; cart phiên A không thể đọc/sửa bởi phiên B.

## FR-05 — Mã giảm giá
Một ô áp dụng/xóa code; Medusa là nơi xác nhận hiệu lực, điều kiện và tổng tiền.
AC: mã sai/hết hạn/không đủ điều kiện có thông báo; không tự giảm tiền trên FE; v1 UI chỉ quản lý một mã để đơn giản hóa. Không được ghi đè kết quả tính của engine để ép “chỉ một mã”; rule khuyến mại thực tế phải cấu hình/test tương thích.

## FR-06 — Guest checkout
Email, tên người nhận, điện thoại, quốc gia, tỉnh/thành, phường/xã và địa chỉ đường; không bắt buộc tài khoản.
AC: lỗi tại từng field, giữ input khi lỗi, không log thông tin; validation server; không hard-code “quận/huyện luôn bắt buộc”; cấu trúc địa chỉ linh hoạt và mapping Medusa được test. Ngoài phạm vi giao hàng bị chặn với lý do.

## FR-07 — Shipping và tổng cuối
Lấy shipping options theo cart/address; người mua chọn trước bước xác nhận.
AC: thay địa chỉ/quantity/coupon làm kiểm tra lại shipping/tax/total; UI không giữ tổng cũ khi request mới chưa xong; không hiển thị miễn ship nếu backend không xác nhận.

## FR-08 — COD và xác nhận đặt hàng
V1 dùng offline/COD provider phù hợp đã kiểm chứng ở version đã khóa, không cài Stripe chỉ để hoàn thành checkout demo.
AC: cuối form ghi rõ phương thức, tổng tiền và trách nhiệm thanh toán; chỉ tạo đơn sau click “Đặt hàng COD”; `authorized/pending` không được hiển thị là “đã thu tiền”; không tự capture khi chỉ mới tạo đơn; double-click/retry/refresh không tạo đơn thứ hai.

## FR-09 — Kết quả đặt hàng và quyền xem
Xác nhận có mã tham chiếu, tóm tắt, tổng tiền, trạng thái và hướng dẫn liên hệ.
AC: chỉ phiên sở hữu hoặc một cơ chế grant hợp lệ mới xem được; không có endpoint công khai tra cứu bằng `orderId + email`; không expose PII trong URL; session hết hạn thì hướng dẫn liên hệ, không bỏ bảo vệ để tiện. Không xây order lookup xuyên thiết bị trong v1.

## FR-10 — Email giao dịch
Gửi email xác nhận sau khi order đã commit; admin vẫn thấy order nếu gửi email lỗi.
AC: worker xử lý, template escape dữ liệu, khóa idempotency theo `order + loại email + version`; retry có giới hạn; production không sử dụng hộp test; staging chỉ gửi recipient allowlist. Không đính kèm link tra cứu đơn không bảo vệ.

## FR-11 — Medusa Admin và dữ liệu
Chủ shop quản lý product, variant, inventory, region, shipping, promotion, order và fulfillment qua Medusa Admin.
AC: không hard-code catalog trong UI; create/edit admin phản ánh storefront sau cơ chế invalidation; tài khoản demo không tồn tại ở live; stock không bị seed reset khi deploy.

## FR-12 — Tư vấn sản phẩm
Route `/tu-van` và CTA ở catalog mở bộ tìm sản phẩm: category, budget mỗi sản phẩm, màu, mục đích/phong cách; có ô câu mô tả ngắn với giới hạn parser công khai.
AC: kết quả luôn trong catalog, published, channel/region hợp lệ, có giá và có stock; tối đa 3 sản phẩm riêng biệt; lựa chọn variant hiển thị rõ; không tự thêm giỏ. Input mơ hồ được hỏi lại hoặc dùng form, không đoán số tiền.

## FR-13 — Jev adapter và chế độ rules
Một interface thống nhất: `rules`, `opencode-jev`, `mock` (mock chỉ local/test).
AC: thiếu key, timeout, 429, 401, response lỗi, quota, model biến mất → rules hoặc câu hỏi an toàn; không gọi paid fallback; browser không thấy key/raw provider response. Nhãn trạng thái trong vận hành không được gọi rules là Jev.

## FR-14 — Giải thích và UX AI
Kết quả dùng câu template dựa trên thuộc tính: “Còn hàng”, “Trong ngân sách mỗi món”, “Gọn cho bàn nhỏ”.
AC: không nói “94% hợp bạn”, không suy đoán tâm lý, không bịa thông số/giảm giá, không dùng chat khách làm dữ liệu huấn luyện riêng. Người dùng sửa tiêu chí và quay lại mua bằng thao tác thường.

## FR-15 — Chính sách và nội dung
Các trang giới thiệu, liên hệ, giao hàng, đổi trả, thanh toán và riêng tư.
AC: live không có `[điền...]`, email giả, địa chỉ giả, tuyên bố chứng nhận chưa có hoặc dữ liệu seed. Chính sách chỉ được publish sau chủ shop phê duyệt nội dung thực tế.

## FR-16 — SEO và accessibility
Title/meta/canonical, sitemap sản phẩm published, robots theo môi trường; HTML semantic, label, focus, alt, reduced-motion.
AC: staging noindex và có hạn chế truy cập; cart/checkout/order không index; dữ liệu có cấu trúc chỉ chứa giá/availability thật; không sinh aggregateRating nếu chưa có review thật.

## FR-17 — Quan sát và giới hạn lạm dụng
Correlation ID; metric checkout/AI/worker; rate limits; health readiness/liveness; budget/circuit breaker.
AC: log mặc định không có PII, raw prompt/cookie/key; health public không trả config; AI lỗi không kéo readiness của commerce xuống; spam bị giới hạn.

## FR-18 — CI, deploy và khôi phục
Reproducible build; test gates; deployment web/API/worker đúng SHA; migration kiểm soát; backup/restore; rollback.
AC: clean clone build theo lockfile; test migrations trên DB sạch và DB version cũ; có bằng chứng restore; không chạy seed demo mỗi lần start; rollback không tự down-migrate hoặc phục hồi DB làm mất đơn mới.

## FR-19 — Chế độ demo/staging/live
`APP_MODE` là `demo|staging|live`; `CHECKOUT_ENABLED` và phê duyệt live riêng.
AC: demo/staging có banner; chế độ preview công khai không nhận PII hoặc đơn thật; không chuyển thành live chỉ bằng NODE_ENV=production; checkout và AI có kill switch độc lập.

## FR-20 — Tính nhất quán và giao nhận mã nguồn
Tài liệu chạy app, env, scripts, API map, admin guide và runbook luôn khớp code.
AC: task nào đổi hành vi phải cập nhật tài liệu/tests; báo cáo ghi SHA và bằng chứng; bỏ dở có next step cụ thể; không để runtime mock trong tuyến live.

### Phi chức năng chung
TypeScript strict; runtime validation tại mọi trust boundary; errors dễ hiểu; timezone UTC ở lưu trữ; VND không sai nhân/chia 100; không phụ thuộc cloud để chạy unit tests; không lưu secret trong repo. Mục tiêu tải/hiệu năng ở docs/08 là acceptance target, không SLA đã cung cấp.
