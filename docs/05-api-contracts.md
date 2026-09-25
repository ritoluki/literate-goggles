# 05. Hợp đồng API của dự án

**Quan trọng:** endpoint `/api/v1/*` dưới đây là API BFF **do dự án phải xây**, không phải endpoint có sẵn của Medusa hay Jev. Hợp đồng provider ngoài ở docs/06; mapping Medusa phải được agent hoàn tất tại P2 bằng version thực tế.

## 5.1 Quy ước

JSON; UTC ISO8601; snake_case hay camelCase không trộn: BFF dùng camelCase. Schema validation runtime; reject unknown write fields để tránh mass assignment.
Response thành công: `{ data, requestId }`. Lỗi: `{ error: { code, message, fieldErrors?, retryable }, requestId }`.
Không trả stack, raw upstream body, token, internal SQL hoặc PII không cần thiết. `requestId` server tạo/validate, dùng tìm log.
`X-Request-ID` optional; server không tin chuỗi tùy ý dài. Mọi response session/cart/order/AI `private,no-store`.

## 5.2 Endpoints public qua storefront

| Method/path | Input | Output/chính sách |
|---|---|---|
| GET `/api/v1/catalog` | q/category/color/minPriceVnd/maxPriceVnd/inStock/sort/page/limit | products[], total, page; region/channel từ config server |
| GET `/api/v1/products/:handle` | handle validated | ProductDetail published hoặc404 |
| POST `/api/v1/session` | empty body, Origin hợp lệ | tạo cookie, csrfToken; không trả raw session token |
| GET `/api/v1/cart` | cookie | cart hoặc empty snapshot; không nhận cartId |
| POST `/api/v1/cart/items` | variantId, quantity | authoritative cart |
| PATCH `/api/v1/cart/items/:lineId` | quantity | owner-checked cart |
| DELETE `/api/v1/cart/items/:lineId` | none | owner-checked cart |
| PUT `/api/v1/cart/promotion` | code | cart |
| DELETE `/api/v1/cart/promotion` | none | cart |
| PUT `/api/v1/checkout/address` | email, address | updated cart + available shipping |
| GET `/api/v1/checkout/shipping-options` | cookie | eligible shipping options |
| PUT `/api/v1/checkout/shipping` | shippingOptionId | cart totals |
| POST `/api/v1/checkout/review` | method:"cod" | signed reviewToken, expiresAt, cart summary |
| POST `/api/v1/checkout/complete` | reviewToken; Idempotency-Key | order result hoặc pending; không nhận amount |
| GET `/api/v1/checkout/status/:intentId` | owner cookie | pending/succeeded/failed + safe result |
| GET `/api/v1/orders/:reference` | owner cookie | permitted confirmation; not public lookup |
| POST `/api/v1/advisor` | preferences, optional message, clientTurnId | AdvisorResponse normalized |
| DELETE `/api/v1/advisor/preferences` | cookie | clears advisor only |
| GET `/api/health/live` | none | minimal alive |
| GET `/api/health/ready` | none | minimal readiness; no secrets |

Write yêu cầu Origin allowlist và CSRF token gắn session. Session creation không có token trước nên dùng Origin, same-origin JSON và rate limit. Service calls không reuse endpoint browser bằng cách bỏ kiểm tra.

## 5.3 Catalog DTO

`ProductCard`: id, handle, title, thumbnail nullable, categoryKey, priceRangeVnd `{min,max}`, inStock boolean, availableColors[], demo boolean.
`ProductDetail`: card fields + sanitized description, images[{url,alt}], variants[{id,sku,options,priceVnd,available,maxOrderQuantity}], attributes.
Stock boolean là kết quả context backend; không expose lượng tồn nhạy cảm nếu không cần. Không hiển thị available=true khi query inventory lỗi.

Catalog q max100chars; page≥1; limit12 mặc định, max48; min/max0–50.000.000; sort enum. Invalid→400, không gửi raw sort/SQL xuống backend.

## 5.4 Cart DTO

Cart: id dùng debug nội bộ nếu cần nhưng browser không được dùng làm quyền; ưu tiên chỉ public snapshot với revision, currency, items, subtotalVnd, discountVnd, shippingVnd nullable, taxVnd, totalVnd, canCheckout, warnings.
Line: lineId, productId, variantId, title, variantLabel, unitPriceVnd, quantity, totalVnd, available.
Revision là canonical fingerprint hay monotonic revision do server quản lý, không timestamp FE.
Tổng hiển thị phải từ Medusa adapter. Không tính lại `subtotal-discount+shipping+tax` ở FE rồi coi là authoritative; vẫn kiểm thử số học để phát hiện bug mapping.

## 5.5 Review token

Token ký server, hạn5 phút, gắn session/cart/fingerprint/total/currency/shipping/payment method/version. Không chứa PII rõ; có thể là opaque record ID thay JWT.
Chỉ server tạo; key riêng cho token ký. Complete xác minh token chưa expired và cart hiện tại không đổi. Đây là kiểm tra consistency, không thay locking/idempotency.
Sau CART_CHANGED, tạo review mới và yêu cầu người mua xác nhận lại.

## 5.6 Complete/status

Synchronous success201: `data: {status:"succeeded", orderReference, confirmationPath}`. Retry cùng intent đã xong200 với cùng reference.
Đang xử lý202: `{status:"pending", intentId, pollAfterMs:1000}`. Poll max30giây frontend, sau đó hiện liên hệ/tiếp tục kiểm tra; backend reconciliation vẫn kiểm soát.
Idempotency payload mismatch409; invalid review409/422; stock conflict409; checkout disabled503; ownership404 không tiết lộ object.

Không xây `GET order by email+id` fallback vì thiếu session. Cross-device lookup là task mới cần auth/one-time token có review riêng.

## 5.7 Advisor request/response

```json
{
  "preferences": {
    "categoryKey": "laptop-stand",
    "maxPriceVnd": 500000,
    "color": "gray",
    "useCase": "small-desk",
    "style": "minimal",
    "budgetScope": "per-item"
  },
  "message": "một món gọn cho bàn nhỏ",
  "clientTurnId": "a-client-generated-uuid"
}
```

Server validate; message max500chars/2KiB, không forward raw ra model. Chỉ parser nội bộ theo grammar xác định; ngoài grammar hỏi lại.

`AdvisorResponse`: status (`results|clarify|no_match`), mode (`rules|jev|fallback`), normalizedPreferences, recommendations[] (product/variant IDs, price snapshot, reasonCodes, reasons), clarification nullable, notice, requestId.
Không trả `probabilities`/providerUsage cho storefront; metric chỉ internal. Client message không chỉ định model/provider, URL, số candidate hoặc quyền.

## 5.8 Mã lỗi cần có

`VALIDATION_ERROR`, `SESSION_EXPIRED`, `NOT_FOUND`, `CART_CHANGED`, `OUT_OF_STOCK`, `INVALID_SHIPPING`, `PROMOTION_INVALID`, `IDEMPOTENCY_CONFLICT`, `CHECKOUT_IN_PROGRESS`, `CHECKOUT_DISABLED`, `UPSTREAM_UNAVAILABLE`, `RATE_LIMITED`, `INTERNAL_ERROR`.

AI lỗi provider thường **không** trả 500 cho người mua; trả response fallback hợp lệ, trừ retrieval commerce cũng lỗi. Khi catalog lỗi không giả no_match.

## 5.9 Internal endpoints

Catalog invalidation callback được authenticate bằng secret/HMAC riêng + timestamp chống replay, scope tags allowlist; không arbitrary fetch.
Worker heartbeat không cần endpoint public; ghi Redis/DB heartbeat namespace. Admin xem metrics qua bảo vệ auth.
Custom `/store/bff/*` service-authenticated phía Medusa chỉ nhận session từ trusted BFF và thực hiện owner check; không có admin pass-through.

## 5.10 API map bắt buộc ở P2

Agent tạo `state/MEDUSA-API-MAP.md` với mỗi use case: official docs URL, installed version, SDK method/route/workflow, request/response, fields cần include, behavior lỗi/idempotency và đường dẫn integration test.
Phải có: catalog prices+availability, cart create/items/promotions/address, shipping quote/select, payment provider/session, complete cart, recovery lookup, order retrieval, Admin events.
Nếu contract Medusa khác spec nội bộ: adapter chuyển đổi; không đổi frontend theo payload chắp vá. Không coi document discovery là integration đã pass.
