# Backlog thực thi

**Tất cả task ban đầu là NOT_STARTED.** Dependencies không có nghĩa task trước đã hoàn thành. Mỗi task phải cập nhật status, evidence và actual implementation paths.

Không hỏi owner phê duyệt từng task local. T032 có thể BLOCKED bởi G3 nhưng không chặn LOCAL_READY/STAGING_READY/shop rules-only. T038 trở đi cần các gate tương ứng. T050 là nhiệm vụ vận hành được phân công thật, không lời hứa agent tự chạy nền.

| ID | Phase | Công việc | Phụ thuộc | Đầu ra | Điều kiện đạt | Requirements | Acceptance | Status |
|---|---|---|---|---|---|---|---|---|
| T001 | P0 | Khảo sát repository và môi trường | — | state/ENVIRONMENT.md; doctor report | Không ghi đè file; xác minh OS/runtime/network | FR-18 | AT-58 | DONE |
| T002 | P0 | Kiểm chứng versions/bootstrap/API cần thiết | T001 | state/VERSIONS.md; ADR baseline | Đọc primary docs; exact pins/lock policy | FR-18 | AT-58 | DONE |
| T003 | P0 | Chốt sơ đồ trust boundary và plan triển khai | T002 | ADR auth; TASKS/DECISIONS cập nhật | Không pending quyết định local đã có default | FR-20 | AT-09,AT-56 | DONE |
| T004 | P1 | Scaffold workspace và hai app | T003 | apps/*; packages/*; pnpm lockfile | Clean install/build; không placeholder exit0 | FR-18 | AT-58 | DONE |
| T005 | P1 | Local PostgreSQL/Redis/mail và env validation | T004 | infra/compose; env schemas; .gitignore | Health ready; persistent data; bind localhost | FR-17,FR-18 | AT-47 | DONE |
| T006 | P1 | Khởi tạo CI và bộ runner kiểm thử | T005 | CI pipeline; test projects; coverage config | Unit/contract/integration smoke thực chạy | FR-18 | AT-58 | DONE |
| T007 | P1 | Hoàn thành root commands/doctor | T006 | scripts theo docs/09 | Mỗi script có implementation, help, failure exit | FR-20 | AT-58 | DONE |
| T008 | P2 | Map region/channel/pricing/inventory API | T007 | state/MEDUSA-API-MAP.md phần catalog | Queries thật có giá/availability đúng context | FR-02,FR-03 | AT-02,AT-03,AT-17 | DONE |
| T009 | P2 | Module dữ liệu session/ledger/grant/preferences/settings | T008 | Migrations/module links/repositories | Unique constraints; không ORM ngoài workflow tạo order | FR-04,FR-09 | AT-08,AT-22 | DONE |
| T010 | P2 | Seed catalog/config idempotent | T009 | Seed CLI map fixture→Medusa | Seed2 lần24/48; guards live; không reset tồn sau orders | FR-11,FR-19 | AT-01,AT-02 | DONE |
| T011 | P2 | Catalog adapter toàn tập và invalidation | T010 | Catalog DTO/retrieval/snapshot/events | Filter trước phân trang; drafts/không giá excluded | FR-02,FR-03 | AT-02,AT-03,AT-04,AT-43 | DONE |
| T012 | P2 | Session + service-auth + ownership middleware | T009 | BFF middleware/backend guards | Chặn rawStore bypass; session/cookie không leak | FR-04,FR-09 | AT-08,AT-09,AT-10,AT-52 | DONE |
| T013 | P2 | Cart + promotion API | T011,T012 | BFF cart routes + integration tests | Validate quantities/strict fields/engine total | FR-04,FR-05 | AT-07,AT-11,AT-12,AT-16 | DONE |
| T014 | P2 | Shipping/COD configuration + API map | T013 | Shipping/tax demo; COD adapter registry map | 30k/500k thresholds; order chưa paid | FR-07,FR-08 | AT-17,AT-18,AT-19,AT-26 | DONE |
| T015 | P3 | Design system/layout/navigation | T007 | Tokens/components/layout | Responsive mobile/keyboard/focus/empty/error states | FR-01,FR-16 | AT-44,AT-45 | DONE |
| T016 | P3 | Home/catalog/search/filter URL | T011,T015 | Storefront routes/catalog state | URL stable/back; full filtering; error not empty | FR-01,FR-02 | AT-04,AT-05,AT-06 | DONE |
| T017 | P3 | PDP variants/images/availability | T016 | PDP and variant picker | Variant price consistent; sold-out not addable | FR-03 | AT-03,AT-14,AT-51 | DONE (AT-51 upload validation deferred to T033) |
| T018 | P3 | Cart UI và race-safe mutations | T013,T017 | Cart page/badge; request sequence guards | Refresh persists; late responses not overwrite | FR-04,FR-05 | AT-07,AT-11,AT-16 | DONE |
| T019 | P3 | Policies/demo banner/SEO/a11y cơ bản | T018 | Draft policy routes; robots/sitemap metadata | Demo facts labeled; staging noindex | FR-15,FR-16,FR-19 | AT-44,AT-45,AT-46,AT-60 | DONE (policy/legal approval remains G7) |
| T020 | P4 | Guest address/shipping checkout | T014,T018 | Address forms/backend schemas | Unsupported address blocked; totals authoritative | FR-06,FR-07 | AT-19,AT-20 | IN_PROGRESS |
| T021 | P4 | Review fingerprint/signing/token expiry | T020 | Backend review flow; BFF forwarding | Tamper/expiry/cart-change rejected; no PII token | FR-08 | AT-13,AT-53 | NOT_STARTED |
| T022 | P4 | Complete cart locking/ledger/recovery | T021 | Core workflow composition; recovery job/status API | 10parallel/2keys/commit crash→1order | FR-08,FR-09 | AT-15,AT-21,AT-22,AT-23,AT-24,AT-25 | NOT_STARTED |
| T023 | P4 | Order confirmation/owner grant + pending UI | T022 | Confirmation/status routes and pages | No cross-session lookup; no fake success | FR-08,FR-09 | AT-08,AT-25,AT-30 | NOT_STARTED |
| T024 | P4 | Email notification/outbox/provider adapter | T023 | Templates; delivery ledger; bounded retry | Order persists when email fails; unknown-send reconciled | FR-10 | AT-27,AT-28,AT-29 | NOT_STARTED |
| T025 | P4 | Checkout regression end-to-end | T024 | Evidence P4 suite | Money/stock/shipping/COD assertions with real backend | FR-04–FR-10 | AT-13–AT-30 | NOT_STARTED |
| T026 | P5 | Advisor schemas/parser/forms | T011,T019 | Normalization/grammar and UI assistant panel | Money/combo ambiguity; strict DTO no raw outbound | FR-12 | AT-12,AT-37,AT-39,AT-54 | NOT_STARTED |
| T027 | P5 | RulesProvider + reason templates | T026 | Deterministic rank/recommendation implementation | Hard filters0violation; reasons proven by attributes | FR-12,FR-14 | AT-03,AT-38,AT-54,AT-55 | NOT_STARTED |
| T028 | P5 | Safe Jev adapter + contract/fault tests | T027 | Provider abstraction/bounded fetch/validator | Free-only; invalid choice/schema/error→fallback | FR-12,FR-13 | AT-32,AT-33,AT-34,AT-35,AT-36,AT-42 | NOT_STARTED |
| T029 | P5 | Distributed quotas/circuit breaker/kill switch | T028 | Redis counters; concurrency; operational flags | Redis down→zero upstream; caps across replicas | FR-13,FR-17 | AT-31,AT-40,AT-41,AT-50 | NOT_STARTED |
| T030 | P5 | Advisor UI integration/preferences | T029 | Form/chat-like UI/results/clarify/reset | Max2clarify; no probabilities as match guarantee | FR-12,FR-14 | AT-31,AT-37,AT-38,AT-55 | NOT_STARTED |
| T031 | P5 | Offline evaluation runner + 60ca | T030 | Rules report; holdout lock; per-case artifacts | Synthetic labels reviewed; no pretend live accuracy | FR-12,FR-13 | AT-34–AT-42,AT-54,AT-55 | NOT_STARTED |
| T032 | P5 | Opt-in live Jev smoke/eval | T031 + G3 | Key entitlement/model/quality evidence or NOT_RUN | Bounded live calls; stays rules if gate not granted | FR-13 | AT-31,AT-33,AT-42 | NOT_STARTED |
| T033 | P6 | Security/ownership/upload/cache red-team | T025,T031 | Threat tests + dependency/secret audit | No critical/high exploitable unresolved | FR-09,FR-15,FR-18 | AT-08,AT-09,AT-10,AT-47,AT-51,AT-52,AT-59 | NOT_STARTED |
| T034 | P6 | Accessibility/responsive/WebKit regression | T030 | Traces/screenshots/a11y report | Critical journeys keyboard/mobile pass | FR-16 | AT-44,AT-45 | NOT_STARTED |
| T035 | P6 | Observability/health/worker signals | T024,T029 | Structured redacted logs; metrics; heartbeats | API alive not substitute worker healthy | FR-17 | AT-29,AT-47,AT-57 | NOT_STARTED |
| T036 | P6 | Performance/load/query/pool validation | T033,T035 | Staging-like local load report | Bounded queries; documented p95/memory targets | FR-17,FR-18 | AT-40,AT-52 | NOT_STARTED |
| T037 | P6 | Clean clone/full verify and LOCAL_READY | T034,T036 | All offline suites/report/gap ledger | No tests silently skipped; milestone evidence | FR-18,FR-20 | AT-01–AT-45,AT-47,AT-51–AT-55,AT-58,AT-59 | NOT_STARTED |
| T038 | P7 | Staging budget/accounts and IaC/deploy configuration | T037 + G4 | Owner approval; Railway service map; release images | No paid resource without scope/ceiling | FR-18 | AT-56 | NOT_STARTED |
| T039 | P7 | Deploy DB/Redis/backend/worker/storefront staging | T038 | Build/runtime vars; migration job; health | One migrator; exactSHA; actual worker processing | FR-18 | AT-29,AT-46,AT-57 | NOT_STARTED |
| T040 | P7 | R2/domain/email protected sandbox integration | T039 + G6 as needed | Bucket/sender/service auth integration | No r2.dev production assets; no real customer email | FR-10,FR-11,FR-19 | AT-27,AT-46,AT-51,AT-60 | NOT_STARTED |
| T041 | P7 | Backup/restore offsite rehearsal | T039 | Encrypted dumps; restore report isolated env | Counts/integrity/ownership pass; RPO/RTO measured | FR-18 | AT-48 | NOT_STARTED |
| T042 | P7 | Migration/rollback/reconciliation rehearsal | T041 | Previous→new schema/revert image drill | Rollback compatible; no blind DB restore | FR-18 | AT-24,AT-49,AT-50 | NOT_STARTED |
| T043 | P7 | Staging full UAT/synthetic load + STAGING_READY | T040,T042 | Full regression/evidence/UAT checklist | Actual HTTPS/cart/order/worker; not just page available | FR-18,FR-20 | AT-01–AT-60 | NOT_STARTED |
| T044 | P8 | Real merchant/catalog/shipping/tax/privacy review | T043 + G2,G5,G7 | Approved real content/config and source rights | Remove demo claims/data; approved retention | FR-11,FR-15,FR-19 | AT-56,AT-60 | NOT_STARTED |
| T045 | P8 | Provision production secrets/services/domain | T044 + G4,G6 | Isolated DB/Redis/buckets/keys; DNS/TLS | No staging secrets/data copied indiscriminately | FR-18 | AT-47,AT-48,AT-52 | NOT_STARTED |
| T046 | P8 | Release preflight and grouped launch approval | T045 + G8 | Immutable release manifest; owner signature/reference | AI rules if no G3/liveeval; kill switch verified | FR-18,FR-20 | AT-50,AT-56,AT-59 | NOT_STARTED |
| T047 | P8 | Deploy production with checkout disabled | T046 | Migration+image rollout; no-write smoke | Ready/worker/assets/robots/redirects correct | FR-18 | AT-49,AT-57 | NOT_STARTED |
| T048 | P8 | Controlled launch and owner order trial | T047 + explicit approved window | LIVE_APPROVED; supervised test order/cancellation policy | No autonomous money/capture; monitor actual workflow | FR-08,FR-18,FR-20 | AT-26,AT-50,AT-56 | NOT_STARTED |
| T049 | P9 | Admin training and handover | T048 | Owner exercises, access recovery, operations doc | Owner handles COD/email/stock safely | FR-11,FR-20 | AT-26,AT-27 | NOT_STARTED |
| T050 | P9 | 24h/7d post-release review by assigned operator | T049 | Observed metrics/cost/incidents; next backlog | Scheduling assigned to human/system, not chat promise | FR-17,FR-20 | AT-50,AT-57 | NOT_STARTED |
| T051 | P9 | Recovery/retention/security maintenance cadence | T050 | Owner schedule; patch/backup/provider availability checks | No automatic paid switch; recovery drilled periodically | FR-18,FR-20 | AT-33,AT-48,AT-49 | NOT_STARTED |

## Quy tắc đóng task
1. Đọc task và các mục docs liên quan; hoàn tất code và test, không chỉ tạo stub.
2. Chạy kiểm thử đúng lớp; ghi đường dẫn evidence và SHA vào PROGRESS/VERIFICATION.
3. Review diff để tránh bí mật, scope creep, hạ test cho pass hoặc làm mất công việc cũ.
4. Khi fail, chẩn đoán và sửa trong phạm vi; chỉ hỏi owner khi cần quyền/quyết định thuộc G1–G9.
5. Tạo task bổ sung có dependency nếu phát hiện khoảng trống; không tự mở phase2 features.
