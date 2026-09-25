# Hợp đồng tham chiếu
- `decision-provider.types.ts`: interface nội bộ do dự án thiết kế, không phải TypeSafe SDK.
- `bff.types.ts`, `bff.request-schemas.json`, `bff.routes.json`: thiết kế API riêng; agent triển khai runtime schemas và routes.
- `jev.request.example.json`: payload synthetic theo cấu trúc Choice công khai [S01,S02 trong docs/15].
- `jev.response.synthetic.json`: **tự tạo để test parser**, không phải response thu từ provider.
  Giá trị probabilities/confidence chỉ minh họa, không chứng minh khả năng chọn sản phẩm.
- Gateway có thể trả resolved model khác alias request; yêu cầu model string không rỗng, không giả response phải lặp đúng alias.
- Reference không chứng minh key có entitlement. Phải chạy live opt-in, lưu evidence trước enable Jev.
- Types không thay runtime validation. Agent chuyển/generate schemas vào packages/contracts và giữ hợp đồng nhất quán.
- JSON Schema là tập request trọng yếu, chưa phải full OpenAPI. Hoàn tất OpenAPI từ implementation ở P2/P4/P5.
