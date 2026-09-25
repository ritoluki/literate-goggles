# 00. Mục tiêu sản phẩm và phạm vi

## 0.1 Bài toán

Khách muốn tìm phụ kiện phù hợp góc làm việc nhưng không biết nên chọn mẫu nào theo ngân sách, không gian, phong cách và mục đích. Website trước hết phải bán hàng đúng và dễ dùng; AI là trợ giúp tùy chọn, không phải điều kiện để mua.

**Ví dụ hành trình:** mở shop → chọn “góc bàn nhỏ, dưới 300.000đ/món” → nhận các sản phẩm còn bán trong ngân sách → chọn biến thể → thêm giỏ → xem tổng cuối → nhập địa chỉ → xác nhận đơn COD → nhận mã đơn và email.

## 0.2 Persona và quyền

**Khách vãng lai:** xem catalog, dùng bộ lọc/tư vấn, giỏ riêng, guest checkout, xem xác nhận đơn thuộc phiên của mình. Không được xem đơn người khác bằng cách đổi ID.

**Chủ shop:** dùng Medusa Admin để quản lý catalog, tồn kho, đơn hàng, fulfillment, xác nhận đã nhận tiền COD và xử lý trả hàng. Một tài khoản quản trị chủ sở hữu ở v1; không tự xây mô hình nhân viên nhiều cấp.

**Người vận hành kỹ thuật:** xem log đã khử PII, health, metric, trạng thái queue, lỗi provider và release. Truy cập hạ tầng có giới hạn, không chia sẻ mật khẩu.

## 0.3 Phạm vi phải có ở v1

Catalog, category, keyword search, filter, sort, product detail/variants, cart, coupon cơ bản, guest checkout, shipping option, COD thủ công có phân biệt trạng thái tiền, order confirmation, email giao dịch, admin, tư vấn chọn sản phẩm, SEO cơ bản, responsive, accessibility, bảo mật, monitoring, backup và deployment.

Tư vấn AI chọn một gợi ý ưu tiên trong danh sách đã lọc hợp lệ; hai gợi ý còn lại xếp bằng rule và phải khác sản phẩm. Hiển thị lý do từ thuộc tính đã lưu, không tạo thông số/đánh giá giả.

## 0.4 Ngoài phạm vi v1

Marketplace, nhiều người bán, ứng dụng mobile native, loyalty, reviews do người dùng gửi, trả góp, thuế đa quốc gia, nhiều tiền tệ, subscription, tài khoản khách/social login, OMS/ERP, giao vận thời gian thực, cá nhân hóa dựa trên lịch sử nhạy cảm, chatbot CSKH tổng quát và model sinh mô tả.

Không dùng `jev-ultrafast` để click chính website này. Website do mình quản lý có thể gọi API trực tiếp; browser automation chỉ dùng để kiểm thử.

Không dùng Jev để tính giá, kiểm tra stock, duyệt refund, phát voucher, quyết định fraud hoặc tự động đặt hàng. Tách những bài toán có rule rõ khỏi phần phán đoán.

## 0.5 Giả định có thể thay bằng cấu hình

Một kho; một sales channel web; một region Việt Nam; tiền VND; locale vi-VN; timezone hiển thị Asia/Ho_Chi_Minh; timestamps lưu UTC. Ngân sách AI tính **trên một sản phẩm, chưa gồm giao hàng**, phải ghi rõ trên UI.

Catalog mẫu 24 sản phẩm, mỗi sản phẩm 2 biến thể màu; seed có trường hợp hết hàng/không published để kiểm thử. Brand “Bàn Gọn” chưa được kiểm tra pháp lý tên thương hiệu; chỉ dùng như tên làm việc.

Phí ship demo 30.000đ, miễn ship khi giá trị hàng sau giảm giá từ 500.000đ. Đây là dữ liệu test, không phải lời hứa bán hàng. Live phải chủ shop xác nhận và cấu hình bằng shipping/promotion của Medusa; không tính riêng trong FE.

## 0.6 Thước đo

Các mục tiêu dưới đây chưa được đo:
- Zero sai lệch giá/tổng đơn ở bộ test chuẩn; zero truy cập chéo session.
- Có thể hoàn thành checkout khi Jev không hoạt động.
- Tỷ lệ đề xuất vi phạm hard constraints trong bộ eval: 0%.
- Gợi ý hợp lý top-1 đạt ít nhất 85% trên các ca đã có nhãn đa đáp án; so sánh với baseline rules. Nếu Jev không chứng minh lợi ích hoặc chất lượng, giữ rules làm mặc định.
- Thời gian từ submit tư vấn đến kết quả p95 dưới 3 giây ở staging với tải quy định trong test plan.
- Chưa đặt mục tiêu doanh thu/conversion vì chưa có số liệu kinh doanh. Không phát minh uplift.

## 0.7 Nguyên tắc chấp nhận

Một tính năng chỉ xong khi có code thật, kiểm thử phù hợp, bằng chứng và hướng dẫn vận hành. Screenshot đẹp không thay thế checkout đúng. Unit test xanh không thay thế test tích hợp Medusa. Deploy thành công không thay thế backup phục hồi được. Tư vấn mock không thay thế kiểm thử provider thật.

Nguồn framework hỗ trợ: [S05], [S07], [S08]. Tất cả phạm vi và chỉ tiêu trên là quyết định thiết kế của dự án.
