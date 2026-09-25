# 07. Bảo mật và riêng tư

## 7.1 Tài sản và mối đe dọa

Tài sản: key AI/email/storage, admin credentials, customer contact/address, session/cart ownership, giá/tồn kho, đơn hàng, ngân sách API, backup.
Threat actors: bot public, khách đổi ID, trang khác gây CSRF, nội dung catalog/model chứa chỉ dẫn độc hại, key bị lộ, dependency độc hại, lỗi vận hành.
Không coi Jev hay framework là biện pháp authorization.

## 7.2 Các control bắt buộc

**Authentication/ownership:** service auth cho Store API; session owner check mọi cart/order/intent; không dùng email/orderId làm mật khẩu. Session raw token hash trong DB, không localStorage.

**CSRF:** same-origin Origin allowlist + CSRF token ở write; session creation kiểm tra Origin/JSON và rate limit. Missing Origin từ browser write không được tự allow. Server-to-server callback có auth riêng.
**Input:** schema strict; body size; enum; string length; quantity integer; không trust user-provided total/region/channel/model/provider/URL. Sanitize HTML merchant, escape template email.
**Secrets:** server env/secret manager; mã hóa truyền qua TLS; role tối thiểu; key khác staging/prod; rotate có overlap có kiểm soát; không log/check bằng cách in key.
**Headers:** CSP theo thực tế asset, frame-ancestors, nosniff, referrer policy, HTTPS; không copy CSP cho có rồi tắt bằng wildcard khi hỏng. Next.js inline scripts/nonces cần integration test theo phiên bản.
**Uploads:** admin only; allow jpg/png/webp, verify magic bytes, size≤5MB, re-encode để loại metadata; không SVG upload từ nguồn không tin; generated SVG nội bộ seed tách biệt. Không fetch URL arbitrary để download ảnh.
**Dependencies:** lockfile; security audit; secret scan; không install plugin không cần; review postinstall; không chạy shell từ user input/model output.

## 7.3 Store API bypass

Bảo vệ `/store/*` bằng middleware service key và kiểm tra các đường alias/router alternate. BFF-only write không có ý nghĩa nếu raw `/store/carts/:id` vẫn public.
Kiểm thử bằng HTTP client **không gửi Origin** để chứng minh CORS không là control duy nhất. Publishable API key bị biết không được làm bypass.
Admin API không dùng BFF service key thay admin auth. Key BFF không được có quyền export khách hàng hoặc write Admin.

## 7.4 Rate limit và tài nguyên

Catalog30req/10giây/IP khởi đầu; cart write20/phút/session; checkout5/phút/session và giới hạn IP; advisor theo docs06. Đây là cấu hình cần chỉnh theo dữ liệu, không hạn mức nhà cung cấp.
Không dùng IP đơn lẻ làm identity cứng cho tất cả khách vì NAT. Tin forwarded IP chỉ từ proxy đã cấu hình; client X-Forwarded-For không được tự spoof.
Bộ đếm Redis atomic, timeout và backpressure. Quota error không tự fallback qua model tính tiền khác.
Nếu Redis/locks lỗi: cart/checkout write tạm unavailable khi không đảm bảo concurrency; catalog read còn dùng được. Không silently bỏ lock.

## 7.5 Dữ liệu gửi đến AI

Chỉ allowlist normalized numeric/enums và candidate metadata. Không có raw user text/provider direct prompt from browser. Prompt injection trong product description không lọt qua state builder.
Vẫn phải test catalog title/metadata bị chèn `ignore instructions` và output Jev bị sửa. Hàng rào cuối là validation/code, không prompt “hãy an toàn”.
Không bật production diagnostics lưu raw prompt. Không đưa cookie hoặc session hash có thể nối danh tính vào request provider.

## 7.6 Log/telemetry

Allowlist log keys: timestamp, environment, releaseSHA, requestId, routeName, method, status, durationMs, errorCode, provider/model, usage counts, fallbackReason.
Không log body request checkout/advisor, Authorization, cookies, URL query chứa token, email/phone/address, DB URL.
Correlation ID là random per request; join ngắn hạn qua server-controlled reference, không fingerprint người mua.
Error reporting scrub PII trước gửi external. Production mặc định không có session replay/marketing analytics.
Retention kỹ thuật đề xuất14ngày log ứng dụng,30ngày aggregate metric; chủ dự án xác nhận với nhà cung cấp. Lưu trữ đơn và chứng từ là chính sách khác, không dùng các TTL này để xóa.

## 7.7 Email và object storage

Ảnh catalog public bucket riêng. Backup private bucket riêng, access key tách, không chung CDN/domain và không public.
Email worker không chứa key frontend; verified sender domain; staging recipient override; không gửi email thật từ test mặc định.
SPF/DKIM/DMARC: người quản trị DNS xác nhận cấu hình thực tế trước email live. Agent không sửa DNS khi chưa được phép.
Order email không chứa grant không hết hạn hay endpoint đoán được PII.

## 7.8 Admin

Một admin owner; mật khẩu mạnh do người dùng/secret flow đặt, MFA ở identity/access layer khi khả dụng. Nếu Medusa version không có MFA tích hợp, không tự tuyên bố đã có; dùng access proxy được duyệt hoặc nêu rủi ro/block gate trước live.
Login throttling và monitoring; không public demo credential. Tạo tài khoản app không dùng password truyền vào command line có thể bị log ở shared runner.
Admin credential rotation và quyền cloud tách khỏi credentials người mua.

## 7.9 Supply chain/CI

Pull request từ fork không được nhận secrets production. CI test synthetic. Build không in env; debug flag không bật production. CI token least privilege; protected environments cho deploy.
Mọi artifact/version/image digest gắn release SHA; review code của agent cũng phải chạy security checks. Không tự waive critical/high issue; có exploitability review và phê duyệt ngoại lệ nếu thật sự cần.

## 7.10 Human/privacy gate

Trước live, owner xác nhận thông báo riêng tư, mục đích/dữ liệu/nhà cung cấp, quyền khách hàng, retention, xử lý yêu cầu dữ liệu và nghĩa vụ pháp lý hiện hành. Đây là checklist thẩm định, không lời khẳng định website đã tuân thủ.
Không gửi dữ liệu thật tới provider để test trong lúc gate chưa xong. Không bổ sung điều khoản pháp lý giả hoặc thay consent hợp lệ bằng một checkbox kỹ thuật.

## 7.11 Những lỗi phải chặn release

Bất kỳ truy cập chéo cart/order/session; secret trong browser/repo/log; total do FE quyết; checkout đôi; payment COD hiển thị paid sai; upload/fetch SSRF; raw PII gửi AI; debug/mock/admin demo trên live; public backup; bypass Store API; không phục hồi được dữ liệu.
