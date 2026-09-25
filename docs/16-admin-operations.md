# 16. Hướng dẫn chủ shop và thao tác admin cần được triển khai

## 16.1 Onboarding cửa hàng thật

Trước nhập hàng, chủ shop cung cấp brand, thông tin liên hệ/người bán, catalog, ảnh có quyền sử dụng, giá, tồn kho, phạm vi giao và chính sách đã xác nhận.
Agent hỗ trợ import qua Admin/workflow có validation/dry-run; không sửa trực tiếp bảng Medusa. Lưu mapping SKU, kiểm tra duplicate; import không tự publish tất cả.
Không dùng demo data như hàng thật. Xóa/unpublish demo chỉ sau xác nhận đúng môi trường; không xóa orders để “dọn cho sạch”.

## 16.2 Tạo/sửa sản phẩm

Title/handle/category/mô tả/ảnh/thuộc tính; variants màu/SKU/giá; inventory mapping; sales channel. Chỉ publish khi đủ dữ liệu cho mua hàng.
Validate metadata theo schema: key enum, kích thước dương hợp lý, không tự gán `portable` hay `small-desk` nếu không có căn cứ. Thiếu thuộc tính thì lời tư vấn không nhắc.
Sau publish, thử storefront tìm và chọn variant, kiểm tra giá/stock đúng. Tắt một variant phải phản ánh checkout sau revalidation kể cả catalog cache cũ.

## 16.3 Quản lý giá và khuyến mại

Giá/discount cập nhật trong engine, không sửa templateFE. Preview cart mẫu trước áp rule diện rộng.
Không coi giá “0” là cách đánh dấu hết hàng; dùng inventory/status đúng.
Mọi thay đổi promotion/shipping live cần kiểm thử đơn mẫu và nêu ngày hiệu lực. Đơn đã tạo không đổi tổng retroactive theo catalog mới.

## 16.4 Nhập/xuất tồn kho

Chọn đúng location/variant; xem reserved/available theo framework. Không cộng trừ thủ công để bù một thao tác hủy/fulfill nếu chưa biết workflow đã điều chỉnh chưa.
Test chiếc cuối và backorder=false trước mở bán. Nếu phát hiện lệch, tạm ngừng SKU và kiểm kê; ghi audit reason.

## 16.5 Xử lý đơn COD

1. Đơn mới hiển thị “Đã nhận đơn / Chưa thu tiền”, tùy mapping trạng thái thực tế.
2. Nhân sự kiểm tra khả năng giao và dữ liệu liên hệ theo policy shop, không dùng AI tự quyết hủy.
3. Tạo fulfillment bằng workflow/Admin, nhập mã vận chuyển nếu được đơn vị giao cung cấp. Không tạo tracking URL tùy ý.
4. Khi giao xong, cập nhật shipment/delivery theo dữ liệu thực.
5. Khi đã nhận/đối soát tiền COD, người có quyền thực hiện capture/mark paid của offline provider theo hướng dẫn version đã kiểm chứng.
6. Đối chiếu thu thực tế, phí COD và phí giao ngoài Medusa nếu chưa có tích hợp; lưu tham chiếu không nhạy cảm.

“Authorize” không bằng tiền đã nhận; “capture offline” có thể chỉ là ghi sổ. Tài liệu module/admin chính thức mô tả trạng thái và thao tác thanh toán [S27–S28]; agent phải map label không gây hiểu nhầm.

## 16.6 Hủy/đổi trả/hoàn tiền

V1 không có self-service returns portal. Khách liên hệ shop; admin xử lý bằng luồng Medusa được kiểm chứng.
Hủy trước fulfillment khác hủy sau giao; kiểm tra inventory reservations, payments và notification.
Hoàn tiền COD ngoài hệ thống cần người bán thực hiện bằng kênh được thống nhất. Đánh dấu refund trong phần mềm không chứng minh tiền đã đến khách. Agent không tự chuyển tiền hoặc request bank credentials.
Không tự lập chính sách đổi trả theo số ngày đoán; dùng quyết định chủ shop đã duyệt.

## 16.7 Tư vấn AI và catalog quality

Admin cần xem aggregate: số lượt, fallback rate, reason, model version, hard-violation metric; không cần xem raw chat khách.
Nếu lời khuyên sai, kiểm tra metadata, lọc hard, candidate construction rồi mới prompt. Không “fix” bằng bịa attribute cho model chọn đúng.
Tắt AI không làm mất catalog/cart; có thể giữ rules. Muốn bật paid provider hoặc gửi raw text cần change request riêng.

## 16.8 Các trang chính sách

Agent dựng layout/editable config hoặc MDX content cho nội dung, không invent dữ liệu liên hệ thật.
Trước launch chạy content lint phát hiện placeholder, domain.example, test phone, banner demo chưa xử lý, fake reviews hoặc xác nhận pháp lý chưa có.
Nếu shop chưa có thông tin bán hàng đủ, publish demo giới thiệu nhưng checkout/thu PII phải off.

## 16.9 Bàn giao thao tác

Owner thực hành sản phẩm mới→publish→mua staging→xem order→fulfill→đối soát COD→update stock; agent lưu checklist đã chứng kiến/được owner xác nhận.
Có screenshot Admin nhưng không chứa password/PII thật. Không khẳng định chủ shop đã được đào tạo nếu chỉ viết tài liệu.
