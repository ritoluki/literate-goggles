# ADR-0001: P0 runtime và trust boundary

- Status: accepted for local/demo development
- Date: 2026-09-23

## Decision

Giữ các mặc định của repository: workspace TypeScript với Next.js App Router storefront, Medusa v2 backend, PostgreSQL/Redis cho commerce infrastructure, và rules-only advisor mặc định. Browser chỉ đi qua storefront/BFF; provider AI không được gọi trực tiếp từ browser. Medusa là nguồn sự thật cho giá, tồn kho, cart, order, payment và shipping.

Máy hiện tại dùng Node 22.13.0 cho local vì tài liệu chính thức kiểm tra qua Context7 xác nhận Next.js hiện tại yêu cầu Node >=20.9.0 và Medusa yêu cầu Node >=20. Node 24 vẫn là baseline candidate trong product docs, chưa phải prerequisite đã xác minh trên máy.

Cho đến khi có Docker/Compose và pnpm, phát triển tiếp bằng contracts, validation, rules và tests offline. Điều này không miễn trừ integration gate với PostgreSQL/Redis.

## Consequences

- Không cần provider trả phí, cloud resource, email thật, production deployment hoặc dữ liệu khách thật cho P0.
- P1/P2 phải ghi exact installed Medusa/Next versions và lockfile evidence trước khi tuyên bố runtime compatibility.
- Docker/Compose và pnpm là blocker môi trường rõ ràng cho infra và clean pnpm install checks.

## Evidence

- `state/ENVIRONMENT.md`
- `state/VERSIONS.md`
- `docs/03-architecture.md`
- `docs/15-sources.md` (S05, S06, S11)
