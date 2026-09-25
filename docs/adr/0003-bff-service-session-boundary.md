# ADR-0003 — BFF service-auth và guest session
- Status: ACCEPTED (local P2)
- Ngày: 2026-09-25. Phạm vi: T012, FR-04/09, AT-08/09/10/52.
- Bối cảnh: Medusa publishable key chọn sales channel, không xác thực chủ giỏ. Browser phải đi qua Next BFF; raw Store routes không được là đường vòng.
- Quyết định: middleware regex bảo vệ toàn bộ `/store/*` bằng `x-bg-service-key` server-to-server, kể cả core cart/order; custom `/store/bff/*` (trừ route tạo/đọc session) đòi session còn hạn. Backend lưu SHA-256 token 32-byte, không raw token. BFF giữ token trong cookie host-only HttpOnly SameSite=Lax, Secure khi HTTPS; write dùng Origin allowlist và CSRF HMAC gắn session. Session tạo qua Medusa workflow; rate limit Redis atomic 10 lần/phút/IP, lỗi Redis fail-closed.
- Local: `pnpm dev` sinh service/CSRF secrets ngẫu nhiên trong process demo, không lưu Git/log. Non-demo phải cấp secrets riêng ít nhất 32 ký tự và SITE_ORIGIN HTTPS. Cookie session sống 30 ngày; sau restart demo, GET session cấp CSRF mới.
- Trade-off: key service này chỉ xác thực BFF, không thay ownership từng cart/order. Route commerce phải gọi helper owner server-side; T013 kiểm thử cross-session bằng giỏ thật. Rate limit theo IP là ngưỡng bước đầu, phải đo proxy/NAT ở P6.
- Rollback: rollback application cùng release; DB session model đã có từ T009, không có migration mới.
- Bằng chứng: `pnpm verify` PASS; `pnpm test:integration` chặn canonical/alternate Store paths, raw write; DB chỉ có hash; `verify:session-rate-limit` 10/11; unit owner helper.
- Nguồn: [Medusa API middleware](https://docs.medusajs.com/learn/fundamentals/api-routes/middlewares), [Medusa workflows](https://docs.medusajs.com/learn/customization/custom-features/workflow), [ioredis Lua](https://github.com/redis/ioredis#lua-scripting).
