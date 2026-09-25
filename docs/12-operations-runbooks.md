# 12. Vận hành, cảnh báo và khôi phục

## 12.1 Trách nhiệm

Trước live phải có một người chịu trách nhiệm xử lý cảnh báo và một kênh liên hệ đã thử. Đặt tên thật ở state/LAUNCH-APPROVALS, không ghi “AI tự lo” khi chưa có hệ thống chạy nền.
Bật alerts trong dịch vụ thực; một mục trong README không tự phát thông báo.

## 12.2 Metrics tối thiểu

HTTP requests/errors/duration theo route; checkout attempts/success/pending/reconciliation/fail; stock conflicts; unique completed carts; worker heartbeat/queue lag/notification failures; database connection pool/storage; Redis errors; AI calls/latency/fallback reasons/circuit state/usage; daily provider cap và cost estimate.
Không dùng dimension email/sessionToken/raw prompt để tạo metric cardinality/PII. Raw data chỉ trong DB được bảo vệ đúng mục đích.

Ngưỡng khởi đầu:
- Checkout5xx>2% trong5phút với≥20attempts hoặc có integrity incident →P1.
- Bất kỳ suspected duplicate order/ownership leak/sai tổng tiền →P0.
- Worker heartbeat cũ>120giây hoặc pending email>15phút →P1/P2 tùy tác động.
- Backup cuối>8giờ cho lịch6giờ →P1.
- AI fallback>30%/15phút →P2, không wake người trực như mất checkout.
- Cost đạt70% ngân sách ngày/tháng →cảnh báo;90%→owner xem xét;hard stop theo dịch vụ có thể gây downtime, phải hiểu tác động.

## 12.3 RB-01 — Jev lỗi/hết free/quota

Dấu hiệu:401/403/429/529, model missing, timeouts hoặc schema changed.
Hành động tự động: circuit open, chuyển rules, không paid fallback. Không retry hàng loạt.
Người vận hành kiểm tra dashboard/model availability/terms, key scope và budget; không paste key/log raw lên issue.
Muốn đổi model hoặc bật paid: tạo quyết định chi phí mới. Re-enable bằng smoke synthetic và canary được duyệt; ghi thời gian sự cố. Không ảnh hưởng cart/checkout nếu commerce khỏe.

## 12.4 RB-02 — Checkout lỗi hoặc outcome unknown

Kiểm tra trace requestId, CartCompletion/cart/order relationship, worker/DB/Redis, deploy gần nhất.
Nếu integrity không chắc, tắt CHECKOUT_ENABLED ngay theo quyền oncall đã duyệt; browsing có thể giữ. UI giải thích đang bảo trì, không mời click lặp.
Đơn pending: chạy reconciliation có audit, trả existing order nếu có. Không xóa cart/ledger hoặc tự tạo đơn thay.
Nếu cần sửa dữ liệu: kế hoạch dry-run, backup, IDs ảnh hưởng, approval chủ dự án; không SQL sửa core theo phỏng đoán.
Khôi phục: staging reproduce+fix+tests→deploy→smoke→bật checkout theo gate.

## 12.5 RB-03 — Redis/worker outage

Redis down: kiểm tra credentials/private network/resources/persistence. Không reset/FLUSHALL để “thử”.
Cart/order còn ở PostgreSQL; lock/quota không khỏe thì write liên quan tạm fail-closed, không bỏ locking.
Worker restart cùng release SHA/config. Xác nhận event bus/workflow adapters dùng Redis chứ không local process.
Sau khôi phục: queue lag giảm, heartbeat mới, notification dedup, reconciliation pendientes. Không mark hết lỗi chỉ vì API health200.

## 12.6 RB-04 — Email lỗi/gửi lặp

Order không rollback. Kiểm tra sender domain, quota, auth, provider status và NotificationDelivery.
Retry exponential bounded, ví dụ1phút→5phút→30phút→2giờ→8giờ, tối đa5attempts; dead-letter để review.
Dùng idempotency key ổn định ở provider nếu hỗ trợ; timeout sau provider đã nhận cần query/reconcile trước gửi lại. Không hứa exactly-once xuyên hệ thống.
Không retry sau provider idempotency window một cách mù. Liên hệ khách bằng kênh được phép khi email không gửi được; người vận hành quyết, không agent tự mass-mail.

## 12.7 RB-05 — Backup/restore

Schedule logical dump6giờ, mã hóa, checksum, manifest schema/app version, kiểm tra nonempty và success exit; lưu private storage tách scope. Bật platform snapshot theo khả năng. Theo dõi failure rõ.
Restore drill định kỳ hằng tháng hoặc sau schema lớn:
1. Chọn backup trước thời điểm sự cố; xác nhận encryption key và compatibility.
2. Tạo recovery env riêng được duyệt, không nối email/AI/live webhooks.
3. Restore logical dump; migrate nếu cần với kế hoạch đã review.
4. Check counts/order latest timestamp/referential consistency/cart ownership/sample workflows.
5. Ghi actual restore time/data gap và cleanup tài nguyên recovery sau approval.
Restore thật vào live là human gate vì có thể mất đơn phát sinh sau backup. Đóng checkout, export delta khi khả thi, lập kế hoạch reconciliation, rồi owner approve.
Platform snapshots có phạm vi/giới hạn riêng [S15]; không dùng hướng dẫn restore chéo environment trái tài liệu.

## 12.8 RB-06 — Key lộ

Dừng provider/key scope bị ảnh hưởng; revoke+rotate qua kênh an toàn. Xem timeline/Git history/artifact logs/billing, không chỉ xóa .env ở commit mới.
Nếu lịch sử repo có secret, rotation ưu tiên trước history rewrite; rewrite/push cần approval và phối hợp.
Rà browser bundles/log uploads/backups; cập nhật incident, tác động dữ liệu và bước thông báo theo yêu cầu hiện hành được owner/legal xem.
Test key mới bằng synthetic; không đưa secret cũ vào tài liệu sự cố.

## 12.9 RB-07 — Deploy regression

Xác định SHA và manifest N−1; tắt checkout nếu tổng tiền/order integrity ảnh hưởng.
Rollback images tương thích schema; server/worker phải cùng version có thể phối hợp. Không down-migrate tự động.
Theo dõi queue/jobs chạy dở và contracts BFF. Nếu chỉ storefront regression, rollback web có thể đủ nhưng vẫn phải check API compatibility.
Ghi lesson learned và thêm regression test, không chỉ “redeploy lại”.

## 12.10 RB-08 — Sai giá, tồn kho hoặc hàng chưa thật

Tạm unpublish sản phẩm/cảnh báo owner, không tự sửa hàng loạt giá live.
Kiểm tra currency, price context, cache invalidation, variant mapping, stock location và promotions.
Đơn đã tạo dùng snapshot order, không đổi retroactive chỉ để khớp catalog. Quyết định liên hệ khách/hủy/hoàn tiền do chủ shop.
Kiểm thử smokeVND199000 và variant boundaries trước re-enable.

## 12.11 Routine

Hằng ngày: đơn pending/COD, email failures, checkout errors, backup, quota/cost. Hằng tuần: dependencies/security alerts, catalog validity, stock, lỗi404/SEO và storage. Hằng tháng: restore drill, quyền truy cập/key rotation plan, provider pricing/terms và budget review.
Đây là lịch cần cấu hình/phân công, không tuyên bố assistant đang chạy nền.

## 12.12 Support handover

Cung cấp admin guide, non-secret env map, credentials ownership (không passwords), uptime/alert links, backup/recovery location, release/rollback commands thực và contact escalation.
Owner thực hành: sửa tồn kho, xem đơn, phân biệt COD chưa thu/đã thu, tắt checkout/AI và tìm report. Nếu không làm được các bước này, chưa coi vận hành đã bàn giao.
