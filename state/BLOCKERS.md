# Blockers

Không có blocker môi trường, dịch vụ hay API key. T022 đã có recovery job + owner-poll reconciliation; `pnpm verify` PASS cho synthetic ledger-loss recovery và cùng order. AT-25 client-timeout/poll/replay integration PASS. Còn thiếu hard process kill/restart AT-24 và last-unit inventory race AT-15. Runtime ngoài local cần `REVIEW_TOKEN_SECRET` riêng, thiếu thì fail-closed.

## Blocker đã giải quyết

| ID | Task | Nguyên nhân | Bằng chứng giải quyết | Trạng thái |
|---|---|---|---|---|
| B-P0-001 | T005 local infra | Docker/WSL không truy cập được từ sandbox | Chạy qua quyền local được phép: Engine 29.8.0, Compose 5.5.1; PostgreSQL/Redis/Mailpit healthy; migration và integration PASS | RESOLVED 2026-09-24 |
| B-P0-002 | T004 install/build | pnpm lifecycle approval và Medusa build không kết thúc trong lần chạy cũ | `pnpm install --frozen-lockfile` PASS; native postinstall PASS; Medusa backend/admin và Next build exit 0 | RESOLVED 2026-09-24 |

## Pending external gates — không chặn local

| Gate | Chỉ cần khi | Mặc định an toàn |
|---|---|---|
| G2 thương hiệu/catalog | Chuẩn bị nội dung thật | Dùng fixture có nhãn demo |
| G3 Jev key/terms | Thử provider live | Rules + fixture; không paid fallback |
| G4 cloud budget | Tạo tài nguyên tính phí/staging | Không tạo cloud, tiếp tục local |
| G5 merchant/shipping/tax | Thiết lập bán hàng thật | COD/shipping/tax demo |
| G6 domain/DNS/email | Domain hoặc sender thật | Mailpit local; không gửi ngoài |
| G7 pháp lý/riêng tư | Mở thu PII/cửa hàng thật | Nội dung draft, không mở bán |
| G8 release | Mở traffic/nhận đơn thật | Không deploy/mở bán |
| G9 money/destructive | Chi phí hoặc thao tác không thể hoàn tác | Không thực hiện |

## Gaps không phải blocker

- E2E browser, security, load, backup/restore và live Jev vẫn NOT_RUN theo phase tương ứng.
- AT-51 kiểm tra upload/re-encode ảnh chưa chạy; T017 chỉ allowlist URL raster ở Store API. Ghi nhận thực hiện trong T033; chưa cho phép upload ảnh tùy ý.
- Git `origin/main` đã nhận commit `40234a6` (T014); remote CI run chưa xác minh trong phiên này.
