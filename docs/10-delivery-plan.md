# 10. Kế hoạch thực thi theo phase

## Cách làm chung

Một task đủ nhỏ để implement+test trong một phiên hợp lý. Trình tự trong TASKS là graph phụ thuộc, không lịch hứa ngày.
Mỗi phase: đầu vào → tác vụ → kiểm chứng → bằng chứng → state. Không hỏi người dùng “có tiếp tục không” sau mỗi phase nếu không có human gate.
Nếu blocked provider/hosting, đánh dấu task đó và tiếp tục phần độc lập; không tự giảm scope bảo mật. Code phải được review lại sau test, không coi test pass đủ để miễn review.

## P0 — Discovery và chốt tương thích
Đọc: START/00/03/09/15. Tác vụ: khảo sát repo/môi trường; xác minh nguồn; resolve versions; tạo ADR defaults; phân loại human gates.
Output: ENVIRONMENT,VERSIONS,dependency graph,MEDUSA-API-MAP skeleton với mục chưa verify; không gọi đó là đã tích hợp.
Gate: môi trường có thể chạy Node và DB/Redis hoặc có đường dev được duyệt. OS/account blocker hỏi một lần.
AC: phiên bản exact không mâu thuẫn; không thêm chi phí; không ghi đè file.

## P1 — Foundation
Đọc:03/07/09. Scaffold apps/packages; lint/typecheck; env schema; compose; basic health; CI offline; .gitignore/secret scan.
AC: web+API+Postgres+Redis hoạt động; root scripts hữu ích; clean install/build; secret không client.
Bằng chứng: setup commands/versions, health results, initial CI report.

## P2 — Commerce nền và seed
Đọc:01/04/05/16. Config region/channel/kho/shipping/payment; custom sessions/ledger models/migrations; seed; catalog adapter; admin.
AC: seed2lần, product/channel/price/stock read thật, API map có tests thực; admin edit phản ánh API; không SQL core.
Gate COD: chỉ local demo dùng offline provider; live nghiệp vụ chưa cần chốt để làm P2.

## P3 — Storefront và cart
Đọc:02/05/07/17. Home/catalog/PDP; SEO scaffold; session/service auth; cart/promotions; error/loading/a11y.
AC: AT01–12/16–17/43–45/47/52 liên quan đạt; không Store API bypass; mobile+desktop screenshot.
Không bắt đầu dùng AI để che việc search/filter chưa đúng.

## P4 — Checkout/order/email
Đọc:04/05/07/08/16/17. Address/shipping/review token/COD/complete/reconciliation/order grants/email worker.
AC: AT13–30/49/53 đạt; concurrency stock+doubleclick+crash recover; email failure không rollback order; không COD paid sai.
Gate: chủ shop chỉ cần cung cấp email/địa chỉ thật khi staging/live, local dùng synthetic.

## P5 — Advisor rules và Jev
Đọc:06/07/08/17. Parser+criteria form+retrieval/ranking; provider interface; mock faults; adapter wire; cost guard; reason templates.
AC: AT31–42/54–55/59 đạt; rules full flow; free-only no key; optional live smoke/eval có báo cáo riêng.
Nếu thiếu key: hoàn thành rules/adapter offline, ghi LIVE_NOT_RUN. Không chặn P6.
Không mở Jev production trước eval/chấp thuận; shop có thể launch rules.

## P6 — Hardening và release build
Đọc:07/08/11/12. Full integration/e2e, accessibility, load, Docker images, server/worker split, real Redis infrastructure modules, safe cache invalidation, notifications retries, security review.
AC: tất cả gate offline/local đạt; không high/critical issue chưa xử lý; build/start images thật; migrations đã thử nâng phiên bản.
Bằng chứng: QA pack, vulnerability triage, image digests, recovery tests.

## P7 — Staging
Đọc:11/12/13/14. Human approval tạo tài nguyên/cloud budget; set secrets/domain trial; deploy cùng SHA; storage/email sandbox; backups; restore drill; smoke.
AC: STAGING_READY; protected/noindex; server+worker health; customer/commerce parity; bill/usage observations; rollback rehearsal.
Không có tài khoản/budget: tạo manifests/runbook và đánh dấu DEPLOY_NOT_RUN, không báo đã lên staging.

## P8 — Production controlled launch
Đọc:13/14/16. Owner xác nhận brand/catalog thật, legal/payment/shipping/tax, credentials/budget, domain/DNS, oncall, release SHA.
Trước mở: checkout=false; deploy; migrate; smoke synthetic được duyệt; verify catalog; backups; mail; legal content; domain HTTPS.
Chỉ owner approval cụ thể mới bật live+checkout. Order test live cần chủ shop phối hợp, không agent tự mua/thu/refund.
AC: LIVE_APPROVED cùng release checklist không còn blocker critical; approval ghi timestamp/người/phạm vi.

## P9 — Theo dõi sau launch
Theo dõi sát2giờ đầu, kiểm tra hằng ngày trong7ngày đầu theo lịch người vận hành thực sự nhận trách nhiệm.
Review error/cart/checkout/worker/cost/mail; soát đơn COD và backup; làm retrospective. Không hứa agent tự chạy nền khi không có scheduler/automation thực.
AC: báo cáo ngày1/ngày7 có dữ liệu, backlog sửa lỗi, owner biết kill switch/runbook.

## Quyền thay đổi

Local refactor không đổi AC: agent tự quyết ghi ADR nếu lớn. Tăng scope, thay payments, đổi production provider, thêm paid model, đổi privacy/retention: change request cần owner.
Thời gian thực hiện phụ thuộc môi trường, credential và chất lượng kiểm thử; không cam kết “một buổi” hay “một prompt là xong”.

## Definition of done một task

Code đúng scope; test phù hợp đã run; errors/negative cases; docs/API/env được update; review no secrets/no bypass; state có link bằng chứng và next step.
Task chưa live-test không được ghi verified-live; fixture response phải được ghi synthetic.
