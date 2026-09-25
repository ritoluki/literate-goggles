# 04. Mô hình dữ liệu và tính đúng commerce

## 4.1 Catalog

Dùng Product, ProductVariant, ProductCategory, Inventory, Pricing, Region, SalesChannel và StockLocation của Medusa. Thuộc tính tư vấn custom ở metadata/schema do server kiểm tra.

Product: handle unique, title, description đã sanitize, status, category, thumbnail/images, metadata `use_cases`, `styles`, `space_fit`, `material`, `dimensions_mm`, `demo`.
Variant: SKU unique, options màu, price VND, manage_inventory=true, allow_backorder=false, inventory tại kho.
Metadata không được chứa claim tự sinh từ tên sản phẩm; thiếu dữ liệu thì không đưa claim vào lời tư vấn.

Category enum v1: `desk-mat`, `laptop-stand`, `cable-organizer`, `stationery`.
Màu enum: `black`, `gray`, `beige`, `green`, `white`, `brown`; label tiếng Việt tách khỏi key.

## 4.2 Tiền và context

DTO nội bộ dùng `{ amountVnd: number, currency: "vnd" }`, amount là số đồng nguyên không âm, safe integer. Không lưu số tiền formatted “199.000đ”.
Adapter Medusa phải round-trip **199000 VND → 199000 VND → “199.000 ₫”**. Không áp công thức cents `×100` hoặc `÷100` theo thói quen. Các amount/raw big-number có thể cần normalize theo framework [S09], [S10]; chỉ normalize tại adapter.

Region, country, channel, tax context và currency phải consistent ở catalog/cart/advisor. Không dùng base price khi giá khả dụng trong region khác. Không tự cast mọi decimal về integer trước khi engine tính tax; VND display/settlement phải theo quy tắc đã kiểm chứng.

Bộ thử bắt buộc: hàng 199000 + ship 30000 = 229000 trong demo không tax; discount10% =179100; threshold499999/500000; variant khác giá; các trường null/không giá/overflow.

## 4.3 Seed

Dữ liệu nguồn ở `fixtures/catalog.seed.json`; đây là fixture custom, không payload Medusa API.
Script seed map fixture vào workflows chính thức. Chạy idempotent theo `metadata.seed_key`, SKU và handle; transaction/compensation phù hợp.
Chỉ seed ở DB có environment guard `demo|test|staging`. Live seed mặc định từ chối. Không chạy `reset`/drop/truncate để làm seed dễ.
Chạy seed hai lần không tăng số product/SKU/region/shipping option. Tồn kho seed không được reset tự động nếu đã có orders; cần cờ reset demo rõ ràng và DB test riêng.

Tạo region/currency/channel/kho/fulfillment set/service zone/shipping profile/options/tax demo/payment provider đúng quan hệ. Gắn publishable key với channel. Phát hiện seed chạy dở và tiếp tục được.
Tạo tài khoản admin qua lệnh/luồng phù hợp, password ngẫu nhiên local, không hard-code vào script hoặc fixture.

## 4.4 Custom durable models

**CommerceSession**
`id`, `token_hash` unique, `cart_id` nullable unique, `expires_at`, timestamps. Chỉ server đọc token_hash.

**OrderAccessGrant**
`session_id`, `order_id`, `public_reference`, created_at, expires_at. Unique pair; `public_reference` không cấp quyền tự thân. Không tạo link email chứa secret v1.

**CartCompletion**
`cart_id` unique, `session_id`, `status` (`created|processing|succeeded|reconciling|failed`), `workflow_transaction_id` nullable, `order_id` nullable, `cart_fingerprint`, last_error_code, timestamps.
Giữ record tối thiểu theo vòng đời order/cơ chế kiểm toán được chủ dự án xác nhận; không cleanup tự động ledger gắn đơn đã tạo.

**IdempotencyRequest**
`session_id + key + operation` unique; canonical request hash; result pointer; status; expires_at. TTL draft request 24h là lựa chọn kỹ thuật, không xóa CartCompletion khi TTL hết.

**AdvisorPreference**
session scope; normalized criteria; version; updated_at; expires_at 30 phút. Không raw chat.

**NotificationDelivery**
`order_id + template_key + template_version` unique, provider_message_id, attempt_count, status, next_attempt_at; không sao chép full order/customer payload vào log.

**OperationalSetting**
AI/checkout switches, version, changed_by, changed_at, reason. Mutation chỉ admin; audit. Env đặt hard ceiling, DB không thể tự bật paid model trái env.

Dùng migration additive, index phục vụ lookup. Foreign/Module links dùng cơ chế Medusa; không giả foreign key trực tiếp xuyên module nếu framework yêu cầu link.

## 4.5 Cart

Cart tạo lazily bằng Medusa flow, region/channel đã xác định. Thêm hàng nhận variant_id+quantity, không nhận giá; lấy lại cart result.
Quantity nguyên1–10 mỗi variant ở v1; giới hạn stock authoritative có thể thấp hơn. Gộp cùng variant theo behavior framework đã test.
Remove/update/discount/shipping thay cart fingerprint; operation mutex/lock theo cart để tránh lost update. Client nhận phiên bản mới, không ghi đè response mới bằng response cũ.
Cart không phải cam kết giữ hàng. Chỉ thông báo hold/reservation nếu implementation thực sự hỗ trợ và thời hạn được xác nhận.

## 4.6 Luồng checkout bắt buộc

`email/address → valid shipping option → payment collection/session COD → recalculate/review → explicit place order → core complete cart → durable order grant → notification event`.

Phân biệt response complete cart trả order với response vẫn còn cart/error [S08]. Không điều hướng success nếu API chỉ HTTP200 nhưng payload có lỗi.
Revalidate stock/price/shipping tại submit. Nếu total đổi từ màn review, trả `CART_CHANGED` và snapshot mới; khách xem và xác nhận lại, không âm thầm chấp nhận số tiền cao hơn.

## 4.7 Idempotency và kết quả không rõ

Client tạo UUID cho intent đặt đơn, giữ lại khi retry cùng nội dung. Cùng key khác payload →409.
Backend luôn khóa/đối soát theo cart_id, không chỉ theo request key, vì hai tab có thể gửi hai keys.
Ưu tiên core cart completion workflow với locking/recovery do Medusa cung cấp; bổ sung ledger, không xây order insertion riêng. Tên workflow/transaction options phải verify.

Nếu timeout/crash sau khi order đã commit nhưng trước khi trả browser: trạng thái `reconciling`, query cart completion/order association hoặc workflow transaction đã lưu rồi trả **cùng order**. Không gọi tạo order mới để “thử lại”.
Khách poll status với reference intent của phiên; không retry unknown mutation mù. Chỉ một order cho một cart trong test 10 request song song.
Không tuyên bố header `Idempotency-Key` được mọi endpoint Medusa hỗ trợ; idempotency BFF này là tính năng phải xây/test.

## 4.8 COD/payment

Offline/manual provider chỉ ghi nhận trạng thái nghiệp vụ; không chuyển tiền. Kiểm chứng provider có hỗ trợ authorize→manual capture đúng mong muốn; nếu không, implement provider COD tối thiểu theo interface chính thức.
Không gán provider ID đoán sẵn; đọc provider registry/region ở P2 và ghi vào API map.
Chủ shop chỉ mark paid/capture kế toán khi xác minh tiền COD đã được nhận/đối soát. Refund trong phần mềm không được mô tả là tiền đã về tài khoản nếu chưa thực hiện ngoài hệ thống.
Không đưa thông tin thẻ vào app. Online gateway là phase2, cần sandbox, merchant onboarding, signed webhook, duplicate/out-of-order events, refunds và reconciliation mới.

## 4.9 Shipping/tax/địa chỉ

Shipping quote lấy từ backend, có thể chưa xác định trước địa chỉ. Demo flat30k/free threshold500k được cấu hình/test bằng engine.
Tax demo0 không có nghĩa shop thật được miễn thuế. Live phải owner xác nhận cách giá bao gồm/chưa gồm thuế và nghĩa vụ xuất chứng từ. Agent không viết tư vấn pháp lý thay người bán.
Địa chỉ config linh hoạt; đừng nhập một file danh sách tỉnh/huyện cũ rồi coi là nguồn đúng. Live owner duyệt nguồn dữ liệu địa chỉ hoặc dùng text fields rõ label.

## 4.10 Retention và dữ liệu thật

Không xóa order/customer transaction vì session hết hạn. Retention hồ sơ bán hàng/pháp lý do owner xác nhận trước live.
Demo sử dụng dữ liệu tổng hợp, email không deliverable; staging email override allowlist. Dữ liệu production không copy vào test nếu chưa ẩn danh và được duyệt.
