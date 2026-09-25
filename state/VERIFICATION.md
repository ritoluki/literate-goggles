# Sổ bằng chứng ứng dụng

Lần xác minh: **2026-09-25**. Pushed base commit: `03918a0b0f1ff4559dc3456f7276adf1a257ed75`; phần T011 hoàn thiện sau commit còn chưa commit/push.

| Nhóm | Trạng thái | Runtime/env | Lệnh và kết quả | Assertions / gaps |
|---|---|---|---|---|
| Environment | PASS | Node 22.13.0; pnpm 12.6.0; Docker client/server 29.8.0; Compose 5.5.1 | `pnpm run doctor` exit 0 | Docker cần quyền ngoài restricted sandbox, daemon healthy |
| Local infra | PASS | PostgreSQL 17.6; Redis 7.4.5; Mailpit 1.26.0 | `docker compose -f infra/compose.dev.yml up -d --wait`; `docker compose ... ps` exit 0 | Ba service healthy, chỉ bind 127.0.0.1, named volumes giữ nguyên |
| Frozen install | PASS | pnpm 12.6.0 | `pnpm install --frozen-lockfile` exit 0 | 1,333 lock entries qua supply-chain policy; SHA-256 `a1766bec17eb486151244c2fb2e18d1481db544c9574072c33db2750708ef87e` |
| Migration | PASS | Medusa 2.21.1 + PostgreSQL | `medusa db:migrate` hoàn tất migrations/link sync | Lệnh migrate đầu với Redis modules giữ process; migration đã hoàn tất trước khi Ctrl+C. Lần runtime sau xác nhận Redis thật |
| T009 migration | PASS | Medusa 2.21.1 + PostgreSQL 17.6 | `medusa db:generate commerceIdentity`; `medusa db:migrate` | `Migration20260925121436` tạo 7 bảng mới; Medusa báo migrated thành công; không drop/reset bảng core |
| T009 unique constraints | PASS | PostgreSQL 17.6 | SQL integration trong `pnpm test:integration` exit 0 | 7 bảng, 8 unique indexes; duplicate token và duplicate intent bị chặn; transaction ROLLBACK |
| Demo seed | PASS | fixture synthetic, VND | `pnpm run seed:demo` exit 0 hai lần | Lần 1 tạo 24 products; lần 2 tạo 0, nhận 24 đã có; Redis cache/event/workflow/locking connected |
| T010 repeat seed | PASS | Medusa + PostgreSQL local | `pnpm --filter @ban-gon/backend run seed:demo` hai lần (2026-09-25) | Mỗi lần tạo 0 mới; trước/sau 24 products, 48 variants, 48 inventory levels, stocked=1109; không reset tồn |
| T010 live guard | PASS | `APP_MODE=live` process-only override | `pnpm --filter @ban-gon/backend run seed:demo` exit 1 | Từ chối trước khi mutate; không thử seed trên production |
| T010 after-order stock scenario | NOT_RUN | — | — | Chưa có checkout/order demo để test sau một order; seed chỉ tạo level thiếu, không update tồn hiện hữu. Kiểm chứng với order ở T013/T014. |
| T011 selector unit | PASS | Jest 29 / backend TS | `pnpm test:unit` exit 0 (2026-09-25) | Root fixture 1/1 và catalog 3/3; lọc trước pagination, draft/channel/no-price, Unicode, màu + giá cùng buyable variant |
| T011 runtime after test relocation | PASS | Medusa 2.21.1 local | `pnpm test:integration` exit 0 (2026-09-25) | Medusa health 200, DB unique test PASS; test files không còn bị search loader nạp |
| T011 real adapter | PASS | Medusa 2.21.1, region VND/channel demo | `pnpm --filter @ban-gon/backend run verify:catalog-adapter` (lệnh CLI tương đương) exit 0 | 21 published/channel sources, 42 variants; 20 priced eligible; mapping màu và màu đắt hơn budget bị loại; cap 1.000 |
| T011 Medusa+BFF HTTP | PASS | PostgreSQL/Redis/Mailpit/Medusa/Next local | `pnpm test:integration` cold start exit 0 (2026-09-25) | 20 eligible, 12+8 trang, wrong-channel key403, missing key4xx, invalid sort400, BFF no-store; runner tự stop cả hai app |
| T011 product freshness | PASS | Demo fixture, Medusa updateProductsWorkflow | `pnpm --filter @ban-gon/backend run verify:catalog-freshness` (lệnh CLI tương đương) exit 0 | Title đổi phản ánh ở Query ngay; original được khôi phục trong finally và xác nhận sau restore |
| T011 price/inventory edit freshness | NOT_RUN | — | — | Chưa chạy biến động giá/tồn qua Admin workflow; không dùng catalog read làm quyền quyết định cart/checkout |
| HTTP health | PASS | Next/Medusa host local | `pnpm dev`; GET `:3000/` = 200 (14,368 bytes); GET `:9000/health` = 200 `OK` | Root dev chạy đồng thời cả hai app và được dừng sau smoke |
| Integration smoke | PASS | DB/Redis/Mailpit/Medusa thật | `pnpm test:integration` exit 0 (2026-09-25) | PostgreSQL TCP, Redis PONG, Mailpit HTTP 200, Medusa HTTP 200; DB constraint check PASS; runner tự start/stop backend |
| Lint | PASS | ESLint + Medusa plugin 2.21.1 | `pnpm lint` exit 0 | Không còn lint issue/warning |
| Typecheck | PASS | TypeScript 5.9.3/Medusa compiler | `pnpm typecheck` exit 0 | contracts, storefront, backend đều PASS |
| Unit/contract | PASS | Node test + Jest | `pnpm test:unit` exit 0 (2026-09-25) | 1 fixture contract + 3 catalog selector cases PASS; coverage suite sẽ mở rộng theo domain tasks |
| AI offline eval | PASS | rules only | `pnpm test:eval:offline` exit 0 | 60 synthetic cases parsed; không gọi provider live |
| Build | PASS | Next 16.3.5; Medusa 2.21.1 | `pnpm build` exit 0 | Next production build PASS; Medusa backend PASS và admin frontend PASS (~81s) |
| CI definition | PASS_LOCAL_DEFINITION | GitHub Actions workflow | `.github/workflows/ci.yml` review + local commands tương ứng PASS | Remote CI run NOT_RUN trong phiên này |
| E2E desktop/mobile/WebKit | NOT_RUN | — | — | Task phase sau |
| Security/ownership, load/a11y | NOT_RUN | — | — | Task phase sau |
| Deploy/rollback/backup/UAT | NOT_RUN | — | — | Cần phase và human gates tương ứng |

Không có secret/PII thật trong bằng chứng. `.env` local là gitignored và chỉ chứa credential demo local.
