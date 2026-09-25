# Tiến độ triển khai

Trạng thái hiện tại: **P1_COMPLETE / P2_IN_PROGRESS**.

- Phase đã hoàn thành: P0, P1.
- Phase đang triển khai: P2; T008–T010 đã xong, task đang làm T011.
- Last implementation SHA: `1b6586320a8aaf4e4576bc3ac4c1d93bf0335be9` (initial commit, đã push `origin/main`).
- Runtime local: Node 22.13.0, pnpm 12.6.0, Docker Engine 29.8.0, Compose 5.5.1.
- Local services: PostgreSQL 17.6, Redis 7.4.5, Mailpit 1.26.0 đang healthy.
- Medusa: 2.21.1, migration và seed fixture đã chạy; backend/admin build PASS.
- Storefront: Next 16.3.5, build và HTTP smoke PASS.
- Live provider call: NOT_RUN; rules provider vẫn là mặc định an toàn.
- Staging/production/owner launch approval: NOT_CREATED / NOT_CREATED / NOT_GRANTED.

## Lịch sử mốc

| Thời điểm | Phase/task | Thực hiện | Bằng chứng | Kết quả | Bước tiếp |
|---|---|---|---|---|---|
| 2026-09-23 | P0 T001–T003 | Khảo sát môi trường, versions, trust boundary và ADR | `state/ENVIRONMENT.md`, `state/VERSIONS.md`, `docs/adr/0001-p0-runtime-and-boundaries.md` | DONE | P1 |
| 2026-09-23 | P1 T004 | Scaffold workspace, Next và Medusa 2.21.1; tạo lockfile | `apps/`, `packages/contracts/`, `pnpm-lock.yaml` | Source có thật; build còn chờ môi trường | Gỡ blocker Docker/pnpm |
| 2026-09-24 | P1 T004–T005 | Xác minh Docker/pnpm; bật PostgreSQL/Redis/Mailpit; migrate; cấu hình các Redis module; seed 24 sản phẩm hai lần; health/integration | `infra/compose.dev.yml`, `apps/backend/medusa-config.ts`, `apps/backend/src/scripts/seed-demo-products.ts`, `scripts/check-service-dependencies.mjs` | DONE; seed lần hai tạo 0 bản ghi trùng | T006/T007 |
| 2026-09-24 | P1 T006–T007 | CI, root commands, doctor, integration runner; sửa lint/type conflict; frozen install + full build; xóa scaffold tạm đã xác minh | `.github/workflows/ci.yml`, `scripts/run-integration.mjs`, `package.json`, `state/VERIFICATION.md` | P1 COMPLETE | Bắt đầu T008 map commerce API thật |
| 2026-09-25 | P2 T008 | Xác minh region/channel/VND pricing/inventory trong Medusa thật | `state/MEDUSA-API-MAP.md`, `apps/backend/src/scripts/verify-commerce-context.ts` | DONE | T009 |
| 2026-09-25 | P2 T009 | Tạo commerceIdentity module 7 model, migration additive; kiểm tra unique indexes và duplicate transaction rollback | `apps/backend/src/modules/commerce-identity/`, `apps/backend/integration-tests/db/commerce-identity.sql` | DONE; lint/typecheck/unit/eval/integration/build PASS | T010 seed guard và kiểm chứng 24/48 |
| 2026-09-25 | P2 T010 | Seed từ chối live/unset mode, phát hiện handle/SKU xung đột, chỉ tạo inventory level thiếu; seed lại hai lần | `apps/backend/src/scripts/seed-demo-products.ts`, DB local | DONE; 24 products/48 variants, 48 levels và stocked=1109 không đổi; live guard exit 1; lint/typecheck/build PASS | T011 catalog adapter |
| 2026-09-25 | P2 T011 (đang làm) | Triển khai selector lọc toàn tập trước pagination; test draft/channel/giá, Unicode và variant-level color/budget; sửa Jest runner chạy được trên Windows | `apps/backend/src/search/catalog.ts`, `apps/backend/integration-tests/unit/catalog.unit.spec.ts`, `apps/backend/scripts/run-jest.mjs` | PARTIAL; unit 3/3, lint/typecheck/integration/build PASS; retrieval/API/invalidation chưa làm | Nối Medusa Query với selector, BFF catalog và invalidation |

## Ghi chú tiếp tục

- Database local giữ nguyên volume; không chạy `docker compose down -v`.
- Generated starter data EUR/USD vẫn tồn tại cùng fixture Bàn Gọn vì không thực hiện reset phá hủy. Storefront/catalog adapter P2 phải chọn đúng sales channel demo và loại dữ liệu starter.
- `medusa build` không bị deadlock: pha admin frontend có khoảng lặng dài; lần PASS gần nhất mất khoảng 81 giây riêng frontend.
- Dùng `pnpm run doctor`, không dùng `pnpm doctor` vì pnpm 12 có built-in command cùng tên.
- Không reset trạng thái khi đổi chat; đọc state và kiểm tra filesystem trước khi tiếp tục.
- T011 chưa đạt AC: selector thuần đã có, nhưng chưa có route catalog thật, full retrieval theo region/channel và invalidation events. Không dùng mảng demo hard-code ở storefront như catalog thật.
