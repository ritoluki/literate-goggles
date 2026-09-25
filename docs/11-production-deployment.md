# 11. Triển khai staging và production

## 11.1 Đường chuẩn

Dùng Railway cho storefront, Medusa API, Medusa worker, PostgreSQL và Redis. Product images dùng R2/S3; email dùng provider đã duyệt. Đây là lựa chọn triển khai đề xuất, **không phải quyền tạo tài nguyên trả phí**.

Vercel là lựa chọn thay thế sau ADR, không đường hướng dẫn chính. Không dùng Vercel Hobby cho shop thương mại vì điều khoản hiện tại giới hạn non-commercial [S17].
Railway có subscription/usage riêng [S14]; không giả giá base5USD bao trọn mọi service. Trước cấp tài nguyên cần cost estimate và owner approval.

## 11.2 Môi trường

Dev: local DB/Redis/dữ liệu demo. Staging: tài nguyên riêng, khóa riêng, shipping/email test, access protection+noindex. Production: DB/bucket/secret riêng, catalog thật, billing/oncall được xác nhận.
Không dùng database production cho preview/PR. Không kết nối `localhost` từ cloud app rồi nghĩ là DB cloud.
Region triển khai chọn gần người dùng và các provider, sau kiểm tra availability; không tự tạo multi-region.

## 11.3 Bảng dịch vụ

| Service | Root/build | Runtime | Public |
|---|---|---|---|
| storefront | root repo; `infra/Dockerfile.web` | Next standalone; bind0.0.0.0:$PORT | yes |
| medusa-api | root repo; `infra/Dockerfile.backend` | workerMode=server,admin enabled | Admin/health; Store routes service-auth |
| medusa-worker | cùng backend image/SHA | workerMode=worker,admin disabled | no |
| postgres | provider service/version pin | persistent volume,backup | private |
| redis | provider service/version pin | persistence/config phù hợp job/locks | private |

Shared monorepo phải giữ root build context để thấy lockfile/packages; không đặt root `apps/storefront` rồi mất contracts. Railway hỗ trợ cấu hình riêng từng service [S12].
Watch paths gồm app tương ứng, shared packages, root lock/config và infra. Không chỉ watch app mà bỏ shared contract changes.

## 11.4 Build artifacts

Next: standalone output +static+public đúng đường dẫn; agent kiểm tra generated paths và tạo start command thực, không đoán `server.js` ở root.
Medusa: production build theo docs version khóa [S07], thường có output riêng dưới `.medusa/server`; runtime dependencies/package workspace resolution phải được kiểm chứng bằng chạy image sạch.
Không chạy `pnpm dev`, `next dev`, `medusa develop` trên production. Không chứa dev env hoặc fixture keys trong image.
Build không migrate/seed; build từ SHA+lock+image digest. Tiết kiệm bằng reuse backend image cho API/worker, không khác dependencies.

## 11.5 Runtime config

API: `NODE_ENV=production`, workerMode server, admin enabled, DATABASE_URL/REDIS_URL, JWT_SECRET/COOKIE_SECRET độc lập, CORS origins chính xác, public backend URL dùng Admin, service auth secret.
Worker: cùng database/Redis, workerMode worker, admin disabled, notification/storage/config cần thiết. Không mở ingress.
Storefront: internal backend URL +public site origin; BFF service secret; CSRF secret; review signing key chỉ ở backend; APP_MODE staging/live; no NEXT_PUBLIC_ secrets.
Tất cả secrets dùng provider secret store; không gọi `printenv` vào log CI.
Environment parser từ chối placeholder, host không phù hợp, public loopback hoặc mock provider trên live.

## 11.6 Redis infrastructure không chỉ REDIS_URL

Medusa production phải cấu hình cache, event bus, workflow engine và locking adapter đúng phiên bản/nhu cầu [S06–S07]. Chỉ đặt REDIS_URL mà vẫn in-memory event bus khiến worker không nhận event.
P6 phải chứng minh: API emit event →worker xử lý; worker restart →job không mất; distributed lock bảo vệ concurrency; quota Redis riêng namespace. Không `FLUSHALL`.
Có readiness Redis, connection pools, timeout/retry bounded; queue depth và heartbeat riêng.

## 11.7 Migration duy nhất và deploy order

1. Freeze release SHA, ghi `ops/release-manifest.example.json` thành manifest thực.
2. Đảm bảo backup gần nhất hợp lệ; migration diff được review, chạy thử staging.
3. Chạy một release/pre-deploy migration job cho API, không worker và mọi replica. Railway pre-deploy có các giới hạn runtime/filesystem phải đọc [S13].
4. Migration additive tương thích version cũ; config/schema rollout backward-compatible.
5. Deploy API+worker cùng SHA, chờ health/heartbeat.
6. Deploy storefront tương thích contract.
7. Smoke tests read-only và synthetic flow được duyệt.
8. Owner phê duyệt mở checkout/AI rollout theo mức đã kiểm chứng.

Pre-deploy command fail phải block release. Không tự retry migration phá hủy. Không seed demo bằng start hook.

## 11.8 Storage

S3 provider cấu hình endpoint/region/bucket/credentials và public base URL [S18]. R2 là S3-compatible target cần upload/get/remove tests, không giả mọi option AWS chạy y hệt.
Bucket catalog public qua custom domain; không dùng `r2.dev` như CDN production theo tài liệu R2 [S19]. Bucket backups riêng private, credentials riêng, retention rõ.
Không lưu ảnh mới vào filesystem container ephemeral rồi mất khi redeploy.
Image allowlist trong Next; không cho optimize arbitrary URL nội bộ.

## 11.9 Email

Verified sender/domain, hạn mức và credential live. Medusa notification adapter dùng interface đúng version [S23] và email API chính thức [S24].
SPF/DKIM/DMARC/DNS thay đổi do owner hoặc agent đã được cấp phép thực hiện. Test email chỉ recipient được owner đồng ý.
Staging recipient override được assert bằng test; production phải bỏ override nhưng không chuyển sang gửi thật tự động khi gate chưa duyệt.
Email fail không cản đọc order; alert backlog/retry; xem runbook.

## 11.10 Domain/HTTPS

Dùng `shop.<domain>` hoặc apex cho storefront, `admin.<domain>` cho Medusa, `assets.<domain>` cho ảnh nếu đã có domain.
Owner mua/cấp domain và approve DNS. Validate TLS, redirect canonical, cookie domain host-only, CORS và admin origin; không dùng wildcard origins.
Staging access control ngoài robots vì noindex không bảo vệ dữ liệu.
CSP/secure cookie hoạt động sau reverse proxy; configure trust proxy chính xác.

## 11.11 Backup và restore gate

Snapshot schedule không thay bản sao độc lập. Railway volume snapshots có phạm vi/giới hạn restore riêng [S15]; tạo logical dump encrypted sang private storage tách scope. Agent không được ghi runbook “restore snapshot thẳng sang project khác” nếu platform không hỗ trợ.
Thiết lập baseline dump mỗi6giờ, retention7ngày và daily snapshot theo khả năng provider; đây là yêu cầu thiết kế cần scheduler/budget.
Mục tiêu RPO≤6giờ, RTO≤4giờ cho shop nhỏ; owner phải chấp nhận khả năng mất đơn trong cửa sổ này hoặc chọn PITR/backup tốt hơn trước live.
Restore drill vào môi trường recovery riêng bằng logical dump; không restore vào live để test. Check order counts/latest timestamps/foreign links/ownership/representative workflows và upload asset references. Lưu thời gian thực.

## 11.12 Rollback

Rollback image/SHA khác với rollback DB. Giữ N−1 tương thích schema mới bằng expand/contract; không tự down-migrate.
Nếu sự cố: tắt checkout khi integrity không chắc, giữ browsing nếu an toàn; rollback web/API/worker về manifest tương thích; không restore DB làm mất đơn mới mà chưa owner approve.
Nếu migration không backward-compatible cần maintenance window, plan riêng và human gate; v1 ưu tiên cấm destructive release.

## 11.13 Health và smoke

Liveness chỉ tiến trình; readiness kiểm tra DB/Redis+config thiết yếu bounded. AI provider/email outage không làm whole commerce readiness fail nếu core vẫn an toàn.
Worker heartbeat mỗi30giây, alert sau120giây; đo queue depth; server200 không chứng minh worker khỏe.
Smoke: catalog valid, image200, cart owner check, checkout disabled đúng lúc, demo complete trên staging, no secrets, noindex staging, mail test, metrics+backup.

## 11.14 Rollout AI

Live commerce có thể chạy rules hoàn toàn. Jev bật bằng feature flag sau eval/privacy/free-only gate, đầu tiên giới hạn nội bộ hoặc tỷ lệ nhỏ được duyệt. Sẵn kill switch.
Không tự A/B experiment bằng dữ liệu cá nhân hay inference lịch sử; v1 random assignment nếu thật cần chỉ sau kế hoạch đo và privacy review.

## 11.15 Bàn giao deploy

Ghi service IDs/URLs không-secret, commit/image digests, build/start/migrate commands thực, config keys, network/domain mapping, test evidence, backup location/retention, người trực, rollback SHA và chi phí quan sát.
Nếu chưa thực sự deploy: status DEPLOY_NOT_RUN; scripts/manifests sẵn không có nghĩa STAGING_READY.
