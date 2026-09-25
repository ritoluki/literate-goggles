# Sổ bằng chứng ứng dụng

Lần xác minh: **2026-09-26**. T013 pushed commit: `75cb63c`; T014 đang ở worktree.

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
| T012 service auth/session HTTP | PASS | Medusa 2.21.1 + Next 16.3.5 + PostgreSQL local | `pnpm test:integration` exit 0 | 6 raw Store paths với publishable key/no Origin trả 403; BFF session Origin/body strict; cookie HttpOnly, SameSite Lax; JSON không lộ raw token; DB chỉ lưu SHA-256 hash |
| T012 ownership helper unit | PASS | Jest 29 | `pnpm test:unit` exit 0 | 5 session cases: malformed, expired, cart đúng/sai, unbound và middleware thiếu session; tổng backend 9/9 |
| T012 Redis session limiter | PASS | Redis 7.4.5 local | `pnpm --filter @ban-gon/backend run verify:session-rate-limit` exit 0 | Synthetic IP: 10 lần đầu allow, lần 11 deny trong cùng window; không tạo DB session |
| T012 full verify | PASS | Node/Medusa/Next/Docker local | `pnpm verify` exit 0 (2026-09-25) | doctor, zero-warning lint, typecheck, unit backend 9/9, rules fixture 60, integration DB/HTTP, Next+Medusa/admin build |
| T012 cart cross-session/CSRF write | PASS | Medusa + Next + PostgreSQL local | `pnpm test:integration` exit 0 (2026-09-26) | Session B không xem/sửa line của A; CSRF và cross-Origin bị 403; body có cartId/amount bị 400 |
| T013 cart + promotion HTTP | PASS | Medusa 2.21.1 + Next 16.3.5 + PostgreSQL/Redis | `pnpm test:integration` exit 0 (2026-09-26) | Lazy cart, refresh recovery; 199000 VND + BGDEMO10 = 179100, qty2 = 358200; remove promo = 398000; invalid code 409/no total change; delete line total0 |
| T013 quantity/locking | PASS | Core addToCartWorkflow + Redis locking | `pnpm test:integration` exit 0 | Strict 1–10; hai adds song song qty5 vào cart qty1: một 200, một 409; cuối cùng qty6; hook chạy sau core lock |
| T013 rate limits | PASS | Redis 7.4.5 + Medusa middleware | `verify:session-rate-limit` và `pnpm test:integration` exit 0 | 20 write/session/min allow, lần21 trả 429 từ backend; session create 10/11 vẫn PASS |
| T013 seed promotion idempotence | PASS | PostgreSQL local synthetic fixture | `pnpm db:seed:demo` lần hai exit 0; SQL count | 0 product mới, 24 cũ; đúng một BGDEMO10 active; không reset dữ liệu/stock |
| T013 full checks | PASS | Node 22.13.0 + Medusa/Next local | `pnpm verify` exit 0; sau hook chạy lại `pnpm lint`, `pnpm typecheck`, `pnpm test:integration` đều exit 0 | doctor/unit9/9/offline60/health/Medusa+Next build PASS; race test chạy ở integration cuối |
| T014 shipping seed repeat | PASS | Medusa 2.21.1 + PostgreSQL local | `pnpm db:seed:demo` hai lần exit 0 (2026-09-26); SQL count | Demo fulfillment set/zone/shipping option mỗi loại đúng 1; không sửa/xóa Europe starter |
| T014 shipping engine | PASS | Medusa Pricing Module + cart workflows | `verify:demo-shipping` exit 0 | VN quote 30000 trên giỏ 199000; cart item_subtotal199000, shipping30000, tax0, total229000; item_total499999→30000, 500000→0; US address bị từ chối |
| T014 COD uncaptured order | PASS | pp_system_default + Medusa complete/cancel workflows | `verify:demo-shipping` exit 0 | Synthetic order tạo từ cart/payment session, captured_amount=0, không có captured_at; workflow cancel sau assertion, event reservation-item.deleted; không có tiền/mail thật |
| T014 full verify | PASS | Node 22.13.0 + PostgreSQL/Redis/Mailpit/Medusa/Next | `pnpm verify` exit 0 (2026-09-26); `pnpm lint` rerun exit 0/no warning | doctor, typecheck, unit9/9, offline60, integration cart+shipping+COD, Next/Medusa/admin build PASS |
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
