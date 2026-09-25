# 14. Nghiệm thu và quyết định mở bán

## 14.1 LOCAL_READY

Môi trường reproducible; dependencies pin; app/DB/Redis chạy;24products/48variants seed idempotent; catalog/cart/checkout demo thật; rules advisor; offline tests; README/local commands; không secrets.
Không yêu cầu cloud accounts để đạt mốc này.

## 14.2 STAGING_READY

Mọi LOCAL gate + cloud approval, isolated resources, HTTPS/access protection/noindex, actual deployed image SHAs, server/worker+Redis adapters, object upload/read, test email, full end-to-end và security controls.
Có restore drill, rollback rehearsal, load report và observed cost. Chưa live-test Jev thì giữ rules, ghi rõ, không chặn commerce staging.

## 14.3 Checklist trước LIVE_APPROVED

### Sản phẩm/kinh doanh
- Brand/domain/thông tin người bán/liên hệ do owner xác nhận.
- Catalog thật, ảnh có quyền, mô tả/thông số/giá/tồn kho đã rà; không seed SVG như ảnh bán thật.
- Shipping area/fee/free-shipping threshold/tax cách hiển thị được duyệt.
- COD procedure/fulfillment/đổi trả/đối soát và trách nhiệm khi nhận đơn đã được người vận hành thử.

### Kỹ thuật
- AC trọng yếu FR01–20 và AT01–60 được trace đến test evidence.
- Ownership, direct Store API bypass, CSRF, currency/stock, idempotency/crash recovery đều PASS.
- Không high/critical security issue chưa xử lý/được chấp nhận có lý do; không fake test skip.
- Secrets tách môi trường, secure cookies/CSP/rate limits, no PII logs.
- Backup gần nhất+restore drill trong7ngày, RPO/RTO có owner đồng ý; rollback image compatible.
- Worker heartbeat/queue/email/checkout alerts đến người trực thật.
- Production build không dev/mock; migrations reviewed; không startup seed.

### Nội dung/riêng tư
- Chính sách/điều khoản/chứng từ/nghĩa vụ hiện hành được owner kiểm tra; không claims tuân thủ tự động.
- Mục đích và nhà cung cấp xử lý dữ liệu được xác nhận; không raw text/PII ra Jev.
- Privacy log/retention/deletion/support process có người nhận trách nhiệm.

### Chi phí/quyền
- Account ownership, budget và alerts/hard limits đã kiểm tra.
- Model free-only+rules fallback; nếu bật Jev đã có provider live smoke/eval approval.
- DNS/email live/launch window được approve; không auto-reload trái mục tiêu.

### Phê duyệt cuối
- `state/LAUNCH-APPROVALS.md` ghi SHA, environment, approver, timestamp và phạm vi.
- `APP_MODE=live` không đủ tự mở: checkout feature flag chỉ bật sau owner approval.
- Chưa có người vận hành nhận đơn thì giữ checkout off, kể cả code hoàn thành.

## 14.4 Diễn tập nghiệm thu cho owner

Owner xem home/catalog trên điện thoại, chọn variant, đặt một đơn test trong staging, xem trong Admin, xác nhận chưa thu tiền COD, xử lý fulfillment, mô phỏng nhận tiền và email, chỉnh stock và kiểm tra storefront.
Owner thực hành tắt AI nhưng checkout vẫn chạy; tắt checkout; xem backup/alert/report. Không buộc owner đọc toàn bộ code.

Ghi nhận defect bằng expected/actual/requestId/screenshot đã che PII, không chỉ “hình như lỗi”.

## 14.5 Go/no-go

**Go:** các gate bắt buộc đạt với bằng chứng và explicit approval.
**Go commerce/rules-only:** Jev chưa live-verified hoặc không đạt eval, nhưng mọi gate commerce đạt; UI không quảng cáo đang chạy Jev.
**No-go:** có security/price/order/data-recovery blocker, thiếu thông tin bán hàng/pháp lý hoặc chưa có approval ngân sách/mở bán. Không waive để có URL demo đẹp.

## 14.6 Kiểm tra sau launch

Trong cửa sổ người trực đã nhận: smoke read-only, theo dõi lỗi/stock/checkout/email/worker/budget; kiểm tra đơn phát sinh đầu tiên với owner. Không agent tự mua hàng bằng thẻ/tự refund.
Rollback/kill switch theo runbook; ghi release outcome. Sau1ngày và7ngày review real metrics, không suy đoán conversion uplift.

## 14.7 Bộ bàn giao cuối từ Codex

Mã nguồn+lockfile; tests/reports; docs chạy local; API map; version/source ledger; env map; deployment manifest và các URLs không-secret; admin guide; backup/restore/rollback instructions đã chạy; known gaps; release approval.
Mỗi external integration phải ghi một trong `verified-live`, `verified-sandbox`, `offline-contract-only`, `not-implemented`. Không gom tất cả thành “đã tích hợp”.

## 14.8 Khẳng định được phép

“Shop đã được deploy lên staging và testA/B/C đạt ở SHA...” khi có bằng chứng.
“Adapter Jev đã qua fixture tests; chưa gọi API thật” khi chưa có key.
Không dùng “production-ready100%”, “không bao giờ sai”, “miễn phí vĩnh viễn” hoặc “agent không cần bạn làm gì”.
