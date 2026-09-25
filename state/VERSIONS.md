# Phiên bản phải khóa ở P0
Ngày nguồn tài liệu được kiểm tra: 2026-09-21. Exact versions cài trên máy chủ dự án: **chưa xác định**.

| Thành phần | Baseline ứng viên | Exact installed | Nguồn/compatibility | Kiểm chứng |
|---|---|---|---|---|
| Node | 24 LTS candidate; Medusa requires v20+ | 22.13.0 (runtime hiện tại) | docs/15 S05,S11,S21; Context7 official docs | VERIFIED_DOC + LOCAL_CHECK |
| npm | runtime package manager fallback | 10.9.2 | Node/npm CLI | LOCAL_CHECK |
| pnpm | stable phù hợp Node/workspace | 12.6.0 | docs/09; local `pnpm --version` | VERIFIED_LOCAL |
| Medusa/@medusajs packages | v2 stable đồng bộ | 2.21.1 | S05–S10; official create-medusa-app scaffold | INSTALLED + BUILD_PASS + HEALTH_PASS |
| Next | stable App Router phù hợp Node | 16.3.6 | S11; Context7 official docs | INSTALLED + BUILD_PASS |
| React/react-dom | peer của Next | 19.3.0 | Next package metadata | INSTALLED + BUILD_PASS |
| PostgreSQL | 17 candidate + security patch | 17.6 container | official support/Medusa | HEALTHY + MIGRATED |
| Redis | 7.4 candidate + security/license review | 7.4.5 container | official support/Medusa modules | HEALTHY + MEDUSA_MODULES_CONNECTED |
| TypeScript | strict workspace compiler | 5.9.3 | npm registry; local `npm list` | INSTALLED + TYPECHECK_PASS |
| ESLint/@eslint/js | flat-config lint | 9.39.5 | npm registry; local `npm list` | INSTALLED + LINT_PASS |
| Vitest/Playwright/Zod | compatible stable | Playwright Core 1.63.0; Vitest/Zod NOT_INSTALLED | `playwright-core` exact pin + Chromium system install | layout browser test PASS; Vitest/Zod NOT_RUN |
| Docker/base image | Node Debian slim + digest | Docker Engine 29.8.0; Compose 5.5.1 | local runtime | VERIFIED_LOCAL |
| Jev alias | jev-1.13-free | remote alias; not pinned weights | S01 | LIVE_NOT_RUN |

Ghi template repository URL/tag/commit, scaffold command/help, lockfile SHA256, image digest và checked_at.

## P0 compatibility evidence

- Next.js official docs via Context7: current App Router startup enforces Node `>=20.9.0`; canonical command is `pnpm create next-app@latest my-app --yes`.
- Medusa official docs via Context7: Medusa v2 requires Node `v20+` (LTS), Git, and PostgreSQL; `npx create-medusa-app@latest my-medusa-store` is the canonical scaffold command.
- Decision: use Node 22.13.0 for the first local scaffold because it satisfies both verified minimums and is already installed. Node 24 remains an unverified candidate.
- Scaffold command/help: `pnpm dlx create-medusa-app@2.21.1 ban-gon-medusa --skip-db --no-browser --use-pnpm --directory-path apps/backend-medusa`; help verified; source copied to `apps/backend`.
- Lockfile hash after frozen install/build: `a1766bec17eb486151244c2fb2e18d1481db544c9574072c33db2750708ef87e` (SHA-256, 2026-09-24 Asia/Saigon).
Không coi version Node dùng kiểm tra reference trong môi trường soạn tài liệu là Node trên máy người dùng.
Không dùng version tương lai bịa ra, API snippet v1, prerelease không cần thiết hoặc tự cập nhật major sau đã ổn định release.
