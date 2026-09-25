# 08. Chiến lược kiểm thử và bằng chứng

## 8.1 Các lớp

**Unit:** parser tiền/tiêu chí, DTO schemas, rules rank, state allowlist, probabilities/semantic validation, reason builder, review fingerprint, error mapping.
**Integration:** DB thật test, Redis, Medusa workflows, cart/order ownership, seed, pricing, inventory/concurrency, shipping/payment, session và email idempotency.
**Contract:** adapter provider từ fixtures; request fields/schema; malformed/status errors; API map khớp installed Medusa.
**E2E:** browser với backend thật, không chỉ mock mọi route. Playwright Chromium desktop/mobile; chạy ít nhất các luồng trọng yếu trên WebKit trước launch.
**Live smoke/eval:** opt-in bằng key, không chạy PR CI tự động.
**Operational:** migration/restore/rollback/worker failure/cost switch.

Code coverage không thay bằng chứng business invariant. Mục tiêu coverage lines≥80% cho custom domain logic, branch≥80%; guard tiền/ownership/idempotency phải có test mọi nhánh quan trọng dù đã đủ coverage chung.

## 8.2 Ca nghiệm thu bắt buộc

| ID | Thiết lập/thao tác | Kết quả bắt buộc |
|---|---|---|
| AT-01 | Seed DB sạch rồi seed lần2 | 24products,48variants; không nhân đôi |
| AT-02 | Catalog có draft/khác channel | Không lộ qua search,detail,advisor |
| AT-03 | Filter màu+giá với variant khác giá | Chỉ biến thể hợp lệ được chọn |
| AT-04 | Match chỉ có ở trang sau | Search/filter vẫn tìm được |
| AT-05 | URL filter refresh/back | Giữ filter/page đúng |
| AT-06 | API catalog500 | Error state; không giả0results |
| AT-07 | Thêm giỏ rồi refresh/reopen | Cart session giữ đúng |
| AT-08 | PhiênB đổi line/order/intent củaA | Không đọc/sửa được |
| AT-09 | Gọi raw Store API bằng publishable key | Không bypass BFF authorization |
| AT-10 | Cross-origin/missing CSRF write | Bị từ chối |
| AT-11 | Gửi quantity-1/1.5/999/NaN | Reject server |
| AT-12 | Gửi amount/currency/model extra | Reject strict schema |
| AT-13 | Giá thay khi cart đã mở | CART_CHANGED/review mới |
| AT-14 | Item hết hàng sau thêm cart | Không complete sai; thông báo rõ |
| AT-15 | Hai khách mua chiếc cuối | Không oversell theo inventory policy |
| AT-16 | Coupon invalid/expired/remove | Total đúng engine |
| AT-17 | Demo 199000+30000 | Total229000,không sai×100 |
| AT-18 | Ngưỡng ship499999/500000 | Quote đúng cấu hình |
| AT-19 | Address không hỗ trợ | Không chọn shipping trái phép |
| AT-20 | Complete thiếu shipping/review | Reject,không tạo order |
| AT-21 | Click đặt đơn10lần song song | Một order cho cart |
| AT-22 | Hai idempotency keys/hai tab | Vẫn một order |
| AT-23 | Cùng key đổi payload |409,không mutation mới |
| AT-24 | Crash sau order commit trước response | Reconcile trả cùng order |
| AT-25 | Timeout upstream completion | Pending/poll,không đặt mới mù |
| AT-26 | COD order mới | Không gắn đã thu tiền |
| AT-27 | Email provider fail | Order vẫn có; retry bounded |
| AT-28 | Event email gửi lặp | Một delivery logic,không spam |
| AT-29 | Worker restart/loss Redis | Có recovery; không mất order |
| AT-30 | Session hết hạn/order guessed | Không lộ PII |
| AT-31 | AI tắt/không key | Shop+checkout hoạt động |
| AT-32 | AI429/529/500/timeout/HTML200 | Fallback có mode đúng |
| AT-33 | AI401/model missing | Disable+alert,không paid fallback |
| AT-34 | AI trả ID không nằm candidates | Reject/fallback |
| AT-35 | AI NaN/âm/sum sai/choice không top | Reject/fallback |
| AT-36 | AI SHOW+NONE hoặc ASK field đã có | Semantic fallback |
| AT-37 | Input total budget/combo mơ hồ | Clarify,không vượt ngầm |
| AT-38 | Hết candidate | no_match;zero upstream call |
| AT-39 | Prompt injection/raw email/phone | Không xuất trong state gửi ngoài |
| AT-40 | Nhiều concurrent AI requests | Global cap/concurrency không vượt |
| AT-41 | Redis quota fail | Không gọi Jev;rules |
| AT-42 | Provider request bị client sửa model | Không nhận field/không paid |
| AT-43 | Admin sửa product/stock | Invalidation/TTL phản ánh |
| AT-44 | Keyboard/modal/focus/mobile | Không keyboard trap sai/no overflow |
| AT-45 | Lighthouse/axe relevant pages | Không serious/critical a11y chưa xử lý |
| AT-46 | Staging index/checkout/mail | noindex+access gate/test-only |
| AT-47 | Secret scan/browser bundle/log samples | Không key/PII |
| AT-48 | Restore backup vào env riêng | Integrity/order counts/ownership đạt |
| AT-49 | Migration từ release trước | Không mất data;compatible rollback |
| AT-50 | Live release kill switches | AI off không kill shop;checkout off chặn viết |
| AT-51 | Catalog image upload invalid/SVG external | Reject/normalize,safe content |
| AT-52 | Shared cache với hai sessions | Không lẫn cart/order |
| AT-53 | Cart mutated khi review token còn hạn | Complete409,new review |
| AT-54 | Budget per item bằng giá chính xác | Boundary inclusive đúng |
| AT-55 | Không có metadata claim | Không tạo reason không chứng minh |
| AT-56 | Human gates chưa duyệt | Pipeline không enable live |
| AT-57 | Worker heartbeat quá hạn | Alert dù HTTP server200 |
| AT-58 | App build từ clean clone | Lockfile reproducible,no secret required |
| AT-59 | Fixture/mock provider cấu hình ở live | Boot fail hoặc cấm route AI mock |
| AT-60 | Public preview chưa vận hành | Không thu PII/không nhận đơn thật |

## 8.3 AI eval

Dùng JSONL fixture và bổ sung ca thực tế synthetic. Report mỗi ca: expected invariant/acceptable labels, actual, model alias+resolved version, prompt version, latency, fallback, inputTokens nếu có.
Hard-constraint violation=0 là gate, kể cả khi overall accuracy tốt. 85%top1 chỉ áp ca có expected acceptable set, không áp ca no_match/fallback. Có holdout; không sửa expected cho khớp output.
So sánh rules với Jev trên cùng data/same retrieval; chạy lặp các ca dễ dao động; ghi sample size. Không gọi vài demo thành “benchmark chứng minh”.

## 8.4 Hiệu năng và tải

Baseline staging giả định shop nhỏ: 20virtual users, 10phút browse; 5concurrent checkout; 4concurrent upstream AI maximum. Traffic test chỉ synthetic; thông báo trước khi gây tải cloud.
Mục tiêu p95 catalog server≤800ms khi warm, cart≤1000ms, checkout synchronous path≤3s nếu dependencies healthy; advisor end-to-end≤3s với fallback deadline. Cold start report riêng.
Frontend mục tiêu lab LCP≤2.5s, CLS≤0.1; đo ít nhất home/catalog/PDP/checkout trên cấu hình mobile thống nhất. Không đổi cấu hình test để đạt số đẹp.
DB query count/pool không tăng vô hạn; no memory leak sau load; không đặt provider live eval vào load test mặc định.

## 8.5 CI gates

PR: install frozen lock→lint→typecheck→unit/contract→integration DB/Redis→build→e2e smoke→secret/dependency scan.
Nightly/staging: full e2e +WebKit+a11y+load subset+backup check. Provider live opt-in chỉ trusted environment.
Các test cấp credentials chỉ chạy sau approval; fork PR không truy cập secrets.
Report lỗi giữ trace/screenshot đã khử PII; không upload raw production session.

## 8.6 Cách ghi bằng chứng

`state/VERIFICATION.md` link report dưới `evidence/<phase>/<timestamp>/`.
Mỗi report: OS/runtime, versions, SHA, command thực chạy, exit code, timestamp, test counts, relevant logs, known gaps.
Allowed status: PASS/FAIL/NOT_RUN/BLOCKED/NOT_APPLICABLE_WITH_REASON. File test tồn tại nhưng chưa run =NOT_RUN.
Không tự ghi100%tests pass trong bộ tài liệu này: ứng dụng chưa được triển khai.
