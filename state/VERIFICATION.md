# Sổ bằng chứng ứng dụng

Lần xác minh: **2026-09-24 00:38:15 +07:00**. Commit: `NO_GIT_REPOSITORY`.

| Nhóm | Trạng thái | Runtime/env | Lệnh và kết quả | Assertions / gaps |
|---|---|---|---|---|
| Environment | PASS | Node 22.13.0; pnpm 12.6.0; Docker client/server 29.8.0; Compose 5.5.1 | `pnpm run doctor` exit 0 | Docker cần quyền ngoài restricted sandbox, daemon healthy |
| Local infra | PASS | PostgreSQL 17.6; Redis 7.4.5; Mailpit 1.26.0 | `docker compose -f infra/compose.dev.yml up -d --wait`; `docker compose ... ps` exit 0 | Ba service healthy, chỉ bind 127.0.0.1, named volumes giữ nguyên |
| Frozen install | PASS | pnpm 12.6.0 | `pnpm install --frozen-lockfile` exit 0 | 1,333 lock entries qua supply-chain policy; SHA-256 `a1766bec17eb486151244c2fb2e18d1481db544c9574072c33db2750708ef87e` |
| Migration | PASS | Medusa 2.21.1 + PostgreSQL | `medusa db:migrate` hoàn tất migrations/link sync | Lệnh migrate đầu với Redis modules giữ process; migration đã hoàn tất trước khi Ctrl+C. Lần runtime sau xác nhận Redis thật |
| Demo seed | PASS | fixture synthetic, VND | `pnpm run seed:demo` exit 0 hai lần | Lần 1 tạo 24 products; lần 2 tạo 0, nhận 24 đã có; Redis cache/event/workflow/locking connected |
| HTTP health | PASS | Next/Medusa host local | `pnpm dev`; GET `:3000/` = 200 (14,368 bytes); GET `:9000/health` = 200 `OK` | Root dev chạy đồng thời cả hai app và được dừng sau smoke |
| Integration smoke | PASS | DB/Redis/Mailpit/Medusa thật | `pnpm test:integration` exit 0 | PostgreSQL TCP, Redis PONG, Mailpit HTTP 200, Medusa HTTP 200; runner tự start/stop backend |
| Lint | PASS | ESLint + Medusa plugin 2.21.1 | `pnpm lint` exit 0 | Không còn lint issue/warning |
| Typecheck | PASS | TypeScript 5.9.3/Medusa compiler | `pnpm typecheck` exit 0 | contracts, storefront, backend đều PASS |
| Unit/contract | PASS | Node test | `pnpm test:unit` exit 0 | 1/1 fixture contract PASS; coverage suite sẽ mở rộng theo domain tasks |
| AI offline eval | PASS | rules only | `pnpm test:eval:offline` exit 0 | 60 synthetic cases parsed; không gọi provider live |
| Build | PASS | Next 16.3.5; Medusa 2.21.1 | `pnpm build` exit 0 | Next production build PASS; Medusa backend PASS và admin frontend PASS (~81s) |
| CI definition | PASS_LOCAL_DEFINITION | GitHub Actions workflow | `.github/workflows/ci.yml` review + local commands tương ứng PASS | Remote CI run NOT_RUN vì chưa có git/remote |
| E2E desktop/mobile/WebKit | NOT_RUN | — | — | Task phase sau |
| Security/ownership, load/a11y | NOT_RUN | — | — | Task phase sau |
| Deploy/rollback/backup/UAT | NOT_RUN | — | — | Cần phase và human gates tương ứng |

Không có secret/PII thật trong bằng chứng. `.env` local là gitignored và chỉ chứa credential demo local.
