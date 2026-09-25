# 03. Kiến trúc và trách nhiệm

## 3.1 Quyết định kiến trúc

Một monorepo TypeScript, hai ứng dụng deploy và một runtime worker từ cùng backend:

```text
Browser
  | same-origin HTTPS, HttpOnly session cookie
  v
Next.js storefront + BFF
  | private/service-authenticated calls
  v
Medusa API + Admin ---------------- PostgreSQL
  |                                  |
  +------ Redis modules/locks --------+
  |
Medusa API ---- AI advisor module ---- DecisionProvider ---- OpenCode Jev
                                   \--- RulesProvider
Medusa worker ---- notifications / background jobs
```

`AI advisor module` là service đồng bộ trong backend API, **không phải một microservice triển khai riêng**. Browser không gọi trực tiếp provider AI. Upload/file provider dùng object storage; worker không phải HTTP gateway cho advisor. BFF không phải nguồn sự thật thứ hai của commerce.

Medusa có commerce modules/workflows, database PostgreSQL và các infrastructure modules [S05], [S06]. Cách tách server/worker cho production theo [S07]; cấu hình cụ thể phải kiểm chứng ở version khóa.

## 3.2 Stack mặc định và chính sách phiên bản

- Node.js 24 LTS là dòng baseline; khóa patch đã kiểm tra ở P0.
- Medusa v2 dòng stable hiện hành, `@medusajs/*` tương thích với nhau; không dùng snippet v1.
- Next.js App Router stable tương thích Node/React của storefront; TypeScript strict.
- pnpm workspace; một lockfile ở root. Không pha npm/yarn lockfiles do scaffolder tạo.
- PostgreSQL 17, Redis 7.4 là **baseline ứng viên**, cần đối chiếu hỗ trợ, security patch và license phù hợp ở P0; đổi minor/patch an toàn qua VERSIONS. Không giả đây là phiên bản mới nhất.
- CSS: Tailwind nếu scaffolder phù hợp, component accessible; Zod cho validation; Vitest cho unit; Playwright cho e2e; test tích hợp Medusa theo tooling version đó.
- Email: provider adapter riêng dùng Resend API hoặc SMTP được phê duyệt. Không tự giả rằng có official package `@medusajs/notification-resend`.
- Files: Medusa S3 file provider, Cloudflare R2 là target mặc định được kiểm chứng bằng upload/read integration test.

Tài liệu installation Medusa yêu cầu Node tương thích cụ thể và PostgreSQL [S05]. P0 ghi exact version, engine, lệnh bootstrap, commit/tag template, lockfile hash. Trước release không để `latest` trong Docker image hoặc deployment command.

## 3.3 Cấu trúc repository đích

```text
apps/
  storefront/              # Next.js pages, BFF, browser-safe UI
  backend/
    src/api/               # custom store/bff + internal callbacks
    src/modules/           # commerce session, checkout ledger, advisor
    src/workflows/         # composition of Medusa core flows
    src/subscribers/       # order email / catalog invalidation
    src/jobs/              # cleanup, heartbeat, reconciliation
packages/
  contracts/               # DTO/types/schemas shared, no backend secrets
  config/                  # lint/ts config
tests/
  integration/
  e2e/
  eval/
scripts/                   # doctor, seed, verify, release preflight
infra/                     # local compose, Dockerfiles, deploy manifests
docs/ state/ templates/    # preserve this documentation kit
```

Tên package: `@ban-gon/storefront`, `@ban-gon/backend`, `@ban-gon/contracts`. Không dùng workspace symlink trỏ vào file ngoài repository. Agent phải tạo package scripts thực tế sau scaffold, không đưa script rỗng `exit 0`.

## 3.4 Source of truth

| Dữ liệu | Chủ sở hữu |
|---|---|
| Product/variant/category/channel | Medusa Product/Sales Channel |
| Giá/promotion/tax/shipping | Medusa theo cart context |
| Inventory/reservation/order/payment | Medusa workflow/module |
| Session → cart và quyền xem order | custom module phía Medusa, PostgreSQL |
| Checkout idempotency/reconciliation | custom durable ledger + core workflow |
| Advisor preferences | module session, không chứa raw chat |
| Quota/circuit breaker/short cache | Redis, không là kho order |
| Product image | object storage; DB lưu URL/key |
| AI score | dữ liệu tư vấn tạm, không là business authority |

Không thêm Prisma để quản lý bảng core Medusa. Custom model dùng cơ chế module/migration/framework đúng version.

## 3.5 Ranh giới public/private

Storefront public. Medusa Admin cần internet cho chủ shop nhưng vẫn bảo vệ login/rate limit; `/store/*` không được thành đường vòng bỏ qua BFF.

Triển khai middleware service authentication cho các Store API mà storefront dùng: header bí mật server-to-server, allowlist route, private networking nếu có. Tất cả raw cart/order endpoints phải từ chối client browser trực tiếp; CORS **không** thay authorization. Publishable API key cũng không phải bằng chứng sở hữu giỏ/đơn.

BFF chỉ gọi catalog read và custom `/store/bff/*` được định nghĩa. Session token chỉ chuyển qua private/service-authenticated connection; không xuất hiện trong URL, client JavaScript hoặc log. BFF không chấp nhận cart ID arbitrary từ browser.

Nếu thiết kế middleware trên version Medusa không đảm bảo bảo vệ tất cả đường vòng, dừng security gate; không bỏ yêu cầu này để “cho app chạy”.

## 3.6 Session

Cookie host-only `bg_session`: 32 bytes random opaque token, HttpOnly, SameSite=Lax, Secure ở HTTPS; local HTTP chỉ bỏ Secure có kiểm soát.
DB lưu hash token (không raw token), expiry và mapping cart/order. TTL mặc định 30 ngày; dữ liệu order không bị xóa khi session hết hạn.
Session tạo lazily khi tương tác cart/advisor; catalog read không tạo session không cần thiết. Rotate khi có thay đổi xác thực sau này. Các check owner nằm server-side, không dựa cookie cartId tự khai.
Redis down không mất mapping owner, nhưng các write nhạy concurrency có thể bị chặn an toàn cho tới khi locking trở lại.

## 3.7 Caching

Public catalog: cache tối đa 60 giây hoặc tagged invalidation; key gồm region/currency/channel/filter/sort/page/schema version. Không share output có dữ liệu cá nhân.
Cart, checkout, order, session, advisor: `no-store`, `Cache-Control: private, no-store`. Không dùng public ISR cho order confirmation.
Catalog thay đổi phải phát event invalidation có ký/secret, retry ngắn và có TTL fallback. Không khiến một request invalidation có thể fetch URL arbitrary.
AI result không cache shared theo raw text; chỉ cache ephemeral theo canonical criteria + eligible candidate version + model/prompt version nếu cần, mặc định tắt v1.

## 3.8 Tương tác AI

Không hỏi Jev “nên lọc giá hay chưa” khi code biết chắc phải lọc. Code xử lý hard constraints; Jev chỉ phân biệt các lựa chọn mềm trong tập hợp hợp lệ. Không model sinh text bắt buộc, không chain tool vô hạn, tối đa một Jev request cho một lượt tư vấn.

## 3.9 Khả năng chạy độc lập

`AI_PROVIDER=rules`, email local sink và object storage local/dev adapter giúp chạy ứng dụng không cần cloud key. Tất cả mocks có nhãn environment.
Backend/API/worker cùng source và release SHA nhưng khác env runtime. Production migration chạy đúng một release job; không đặt `db:migrate` vào start command của mọi replica.

## 3.10 Không tối ưu sớm

Chưa dùng vector DB, search engine riêng, Kubernetes, event streaming ngoài Redis, CQRS hoặc tự build framework agent. Catalog v1 dưới 1.000 sản phẩm; nếu vượt, đo query plan và chuyển retrieval có ADR, không chỉ tăng prompt lên hàng nghìn sản phẩm.
