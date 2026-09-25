# Môi trường — điền ở P0
- OS/version/build: Windows 11, build 26200 (`Microsoft Windows NT 10.0.26200.0`) — checked 2026-09-23 Asia/Saigon
- CPU/RAM/disk available: NOT_CHECKED
- Shell: PowerShell; `npm.ps1` blocked by ExecutionPolicy, use `npm.cmd`
- Git/version/repo status: NOT_CHECKED
- Node/package manager: Node v22.13.0; npm 10.9.2; pnpm 12.6.0 available; pnpm project store/state works with elevated execution
- Docker/virtualization/WSL: Docker Desktop 4.92.0; Docker Engine client/server 29.8.0; Compose 5.5.1 — VERIFIED_LOCAL 2026-09-24
- Local ports/database/Redis: PostgreSQL 17.6 on 127.0.0.1:5433, Redis 7.4.5 on 127.0.0.1:6380, Mailpit 1.26.0 on 127.0.0.1:8025/1025 — HEALTHY
- Network/proxy constraints: `registry.npmjs.org:443` reachable
- Filesystem/line endings/path issues: NOT_CHECKED
- Chosen local route + evidence: host Node for offline checks; Docker route pending availability; rules provider default

P1 result: local services, migration, idempotent demo seed, Medusa/Next health checks, integration runner, frozen install, lint, typecheck and monorepo build all pass. Docker access from the restricted sandbox still needs an escalated local command, but the daemon itself is healthy.

Không ghi username thật, home path đầy đủ, thông tin máy công ty hoặc token nếu không cần chẩn đoán.
Nếu môi trường thiếu capability, mô tả thao tác đã thử và lỗi thực. Không cài driver/hypervisor/OS update tự động.
