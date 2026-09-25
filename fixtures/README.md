# Dữ liệu synthetic
Không sử dụng fixture làm giá/ảnh/thông tin doanh nghiệp thật. Không import production.

## Catalog
24products,48variants. Hai products draft; một product chỉ ở channel nội bộ; một product chưa có giá; một product hết tồn cả hai variants.
Tất cả đều dùng mã seed ổn định. `seedKey` không phải Medusa ID; seed runner phải ghi map runtime.
SKU của variant thứ hai `gia-laptop-gap` có tồn1 để thử concurrent checkout. Các test mutating dùng DB/reset fixture riêng, không cạnh tranh trên cùng inventory.
Giá null là thiếu giá; tuyệt đối không cast thành0 đồng. Product không có biến thể bán được không được đưa vào advisor.
Images trống có chủ ý. Agent tạo placeholder/local illustration có quyền sử dụng, không gắn ảnh giả vào hàng thật.

## AI eval
60ca:40 tune,20 holdout. Đây là **test seed và policy labels tự soạn**, chưa đánh giá model.
`allowedVariantSeedKeys` là tập variant thỏa hard constraints, **không phải nhãn “gợi ý tốt nhất”**.
Muốn đo top1 quality≥85% ở docs/08, phải bổ sung `acceptableTop1SeedKeys` do người review gán cho các ca quality; không lấy mọi eligible candidate làm “đúng” để thổi phồng accuracy.
`fixtureFault` là yêu cầu mock transport/policy guard; không gửi mô tả fault cho provider thật.
Privacy strings đều synthetic, không gửi raw message ra ngoài. Không chạy fault suite như live benchmark.
Holdout không được dùng chỉnh prompt/threshold. Mở rộng bằng ca synthetic, không copy customer PII.

## Runner agent phải xây
Map IDs→seed keys khi so expected; kiểm tra mọi invariant thay vì chỉ count status.
Report tune/holdout, rules/live, fault/quality riêng; ghi NOT_RUN nếu chưa có key.
Fixture kiểm tra parser không đảm bảo hiểu mọi tiếng Việt; ngoài grammar hỏi rõ và cung cấp form.
