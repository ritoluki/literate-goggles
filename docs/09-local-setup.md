# 09. Thiết lập từ thư mục rỗng

## 9.1 P0: kiểm tra trước khi cài

Agent ghi vào `state/ENVIRONMENT.md`: OS/build, CPU/RAM, shell, Node/pnpm/Git, Docker engine/compose, quyền cài đặt, cổng3000/9000/5432/6379 còn trống và network đến package registries/docs.
Không ghi username máy, home path riêng tư hoặc secret không cần thiết vào báo cáo public.
Lệnh đọc thông tin: `node --version`, `pnpm --version`, `git --version`, `docker version`, `docker compose version`. Trong PowerShell có thể đọc OS qua `Get-ComputerInfo`; không yêu cầu admin nếu không cần.

Chưa có Node/pnpm thì đưa một yêu cầu gọn về cài runtime được hỗ trợ; sau đó agent tự cài dependency trong project. Không tự nâng OS hay cài Docker phiên bản cũ không còn hỗ trợ.
Windows build17763 là trường hợp cần đối chiếu yêu cầu Docker hiện hành [S20], không mặc định dùng được. Dev Linux đã có quyền là đường thay thế; không tự tạo VM trả phí.

## 9.2 Khóa versions trước scaffold

Đọc [S05], [S11], [S21]; kiểm tra package registry/engines và compatibility. Điền bảng exact versions trong VERSIONS.
Một lần resolve stable khi bootstrap là được; sau đó pin CLI/runtime/deps/image digest. Không dùng floating tag khi release.
Chạy `create-medusa-app@<resolved>` với `--help`, lưu flags thực tế. Scaffold backend ở `apps/backend`, không root đang chứa bộ tài liệu. Dùng scaffold Next tương thích ở `apps/storefront` hoặc lấy starter chính thức rồi loại bỏ scope ngoài v1; ghi lý do chọn.

Mặc định tạo Next app riêng, dùng Medusa JS SDK/Store APIs theo guide để UI không mang checkout Stripe bắt buộc. Không bắt đầu từ một codebase demo chưa rõ license.

## 9.3 Chuẩn hóa monorepo

Tạo root package private với packageManager pin; pnpm-workspace gồm apps/*,packages/*. Di chuyển root docs/state giữ nguyên.
Tạo `packages/contracts`; dùng workspace dependency compile rõ; một root lockfile. Nếu scaffold có nested lock, review rồi hợp nhất sau khi chứng minh install/build được; không xóa lock của repo người dùng chưa hỏi.
Cấu hình `.gitignore`, `.editorconfig`, `.gitattributes`, lint, TypeScript, env validation. `.env.example` không được chứa password dùng ở live.

## 9.4 Dịch vụ local

Tạo `infra/compose.dev.yml`: PostgreSQL+Redis+mail sink (khi dùng SMTP local)+object-store/dev file adapter; healthchecks, named volumes. Chỉ bind DB/Redis vào127.0.0.1, không0.0.0.0 public.
App có thể chạy host để hot reload, services trong Docker. Dùng cổng5433/6380 khi cổng mặc định bận và update env thống nhất.
Secrets local sinh ngẫu nhiên trong file gitignored. Không commit URL DB có mật khẩu thực.
Compose pin versions sau P0. Chỉ `docker compose down` giữ volume theo mặc định; `down -v` là destructive, chỉ DB test được xác nhận.

## 9.5 Thứ tự dựng app

1. Infra healthy.
2. Backend config PostgreSQL/Redis/worker shared local; migrate.
3. Tạo admin local bằng cách an toàn phù hợp CLI.
4. Seed idempotent; region/channel/kho/provider/shipping có quan hệ đúng.
5. Catalog Store API kiểm tra giá/availability bằng integration test.
6. Storefront public pages dùng backend thật.
7. Session/BFF ownership/cart.
8. Checkout COD thật trong DB demo.
9. Advisor rules trước Jev.
10. Email, storage và production config.

Không cho FE mock catalog kéo dài đến cuối: từ P2 catalog và cart phải backend thật, mock chỉ test/fault injection.

## 9.6 Bộ script root cần agent tạo

Các lệnh dưới là **hợp đồng script cần triển khai**, chưa tồn tại trong kit hiện tại.

| Lệnh | Kết quả |
|---|---|
| `pnpm doctor` | kiểm tra môi trường; không in secrets; nonzero nếu dependency bắt buộc lỗi |
| `pnpm infra:up` | bật local infra và đợi health |
| `pnpm infra:down` | dừng, giữ volume |
| `pnpm db:migrate` | migrate đúng env; production cần gate ngoài |
| `pnpm db:seed:demo` | idempotent, từ chối live |
| `pnpm dev` | web+backend với log tách; cleanup process khi Ctrl+C |
| `pnpm lint` | lint các packages |
| `pnpm typecheck` | TypeScript tất cả packages |
| `pnpm test:unit` | offline unit |
| `pnpm test:integration` | test DB/Redis riêng, không xóa dev DB |
| `pnpm test:e2e` | browser với app thật |
| `pnpm test:eval:offline` | rules/mock eval |
| `pnpm test:eval:live` | opt-in có budget/provider approval |
| `pnpm build` | builds không mutate DB |
| `pnpm verify` | lint/typecheck/unit/integration/build/e2e phù hợp |
| `pnpm release:preflight` | validate gates/versions/env/manifest; không deploy |
| `pnpm backup:test-restore` | restore vào env test riêng với approval tài nguyên |

Script nào không chạy được phải nonzero và nói thiếu gì; không đặt TODO rồi trả exit0.

## 9.7 Biến môi trường

Mẫu trong `ops/`. Agent map chúng vào app thực, ghi cái nào custom/official. Next public env chỉ label/public URL khi thật cần; secrets ở server runtime.
`APP_MODE=demo`, `AI_PROVIDER=rules`, `CHECKOUT_ENABLED=true` chỉ local/demo không public, `EMAIL_MODE=local` là baseline.
Ở public preview chưa được vận hành, đặt checkout=false và không tạo form thu PII.

`.env` riêng frontend/backend; root script đọc đúng file, không tự load tất cả biến vào browser. Env thiếu key AI không fail commerce; thiếu JWT/COOKIE/session secret ở live phải fail startup.

Local demo: sau `pnpm infra:up`, `pnpm db:migrate`, `pnpm db:seed:demo`, lệnh `pnpm dev` tự đọc publishable key demo từ PostgreSQL local và sinh `BFF_SERVICE_KEY`/`CSRF_SECRET` ngẫu nhiên chỉ trong process. Không in/ghi key vào Git. Khi chạy riêng/staging cần `BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY`, cùng `BFF_SERVICE_KEY` ở Next và Medusa, `CSRF_SECRET` ở Next, `SITE_ORIGIN` HTTPS chính xác; thiếu key thì BFF trả 503 an toàn. `pnpm test:integration` tự bật/tắt Medusa và Next khi chưa chạy, kiểm tra catalog/session/cart/promotion/raw Store bypass, cùng shipping/COD bằng đơn synthetic được hủy sau test. Có thể chạy riêng `pnpm --filter @ban-gon/backend run verify:demo-shipping` sau seed. Nếu đã chạy Medusa riêng, cung cấp đúng `BFF_SERVICE_KEY` cho runner hoặc dừng process đó trước.

## 9.8 Developer experience

README ứng dụng cuối phải có “clean clone → local order” bằng vài lệnh root sau prerequisites; không yêu cầu chủ dự án chạy mười terminal. Cung cấp PowerShell và shell khi syntax khác; không đưa bash line continuation `\` vào CMD rồi giả chạy được.
Test IDs/fixtures ổn định, port config tập trung, logs có requestId, errors không expose secrets.
Lưu troubleshooting: DB refused, migration, CORS, channel key, missing price, shipping option rỗng, COD session, worker không gửi email.

## 9.9 Tài liệu và MCP

Đọc web docs là đủ. MCP Medusa hiện có yêu cầu tài khoản/quyền theo [S22]; không coi MCP công khai không xác thực, và không buộc mua Cloud chỉ để đọc docs.
Muốn thêm MCP phải kiểm tra công cụ Codex hiện hành, phạm vi read-only và hỏi khi cần OAuth/account. Không thêm secret vào config chung của repository.
AGENTS.md giữ ngắn; context dài trong docs đọc theo task [S04].

## 9.10 Definition of ready local

Một người mới có runtime đúng có thể clone/install/infra/migrate/seed/dev, mở storefront, xem sản phẩm, tạo cart và demo order. Lưu lệnh thực tế, screenshot và test report; không chỉ chứng minh trang Next mặc định hiện lên.
