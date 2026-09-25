# 13. Chi phí và những chốt cần chủ dự án

## 13.1 Nguyên tắc

Agent tự chọn kỹ thuật trong scope, nhưng không tự tiêu tiền hoặc giả quyết định kinh doanh. Không cần hỏi trước mọi dependency; phải hỏi trước external commitments.
Đặt default an toàn: local/demo, rules AI, không gửi email thật, không public deployment, không open checkout live.
“Đồng ý làm project” không đồng nghĩa đồng ý mọi khoản phí/account access.

## 13.2 Human gates

| Gate | Khi cần | Chủ dự án quyết/làm | Nếu chưa có |
|---|---|---|---|
| G1 Môi trường |P0| máy/dev environment được hỗ trợ; cài đặt cần quyền admin nếu có | làm docs/types/test có thể chạy; không install OS trái phép |
| G2 Scope/brand |trước dữ liệu live| ngành hàng, brand/domain, catalog thật, quyền ảnh | giữ Bàn Gọn demo |
| G3 Jev |trước live API| cấp key bằng secret, free-only/terms/billing approval | rules/mock có nhãn |
| G4 Staging cloud |P7| account/repo access, dịch vụ/region, ngân sách được duyệt | build/test local+manifests; DEPLOY_NOT_RUN |
| G5 Bán hàng |trước live| người bán, phạm vi giao, giá/thuế, COD/quy trình đối soát, đổi trả/liên hệ | không nhận đơn thật |
| G6 Domain/email |trước public| mua/cấp domain, approve DNS, verified sender | không gửi mail thật/chưa custom domain |
| G7 Legal/privacy |trước live| nội dung/chính sách/nghĩa vụ hiện hành, dữ liệu/provides/retention | checkout live off |
| G8 Launch |P8| approve release SHA, cửa sổ mở, oncall, backup/RPO/RTO, mức rủi ro | giữ staging |
| G9 Tác động dữ liệu/tiền |mỗi sự kiện| destructive migration,restore live,charge/refund/bulk email | không thực hiện |

Không yêu cầu G2–G8 ở P0 nếu có thể phát triển demo. Nhóm những gate cùng thời điểm thành một tin nhắn rõ, không hỏi rải rác.

## 13.3 Mẫu câu hỏi của agent

“Đã hoàn thành local và kiểm thử X. Để deploy staging cần G4: đề xuất Railway với web/API/worker/DB/Redis và ngân sách trần bạn chọn; object storage/email riêng. Chưa tạo tài nguyên. Bạn duyệt provider/ngân sách nào, hay tiếp tục local? Tôi sẽ tiếp tục hardening độc lập trong lúc chờ.”

Câu hỏi phải có: blocker, lựa chọn đề xuất, tác động tiền/dữ liệu, phạm vi quyền, phần vẫn tiếp tục được.
Không hỏi: tên biến, dùng CSS gì trong design tokens, có cần viết test không.

## 13.4 Budget model

Local: không có phí hosting cho app local; có thể có chi phí công cụ/dev services theo tài khoản của chủ dự án. Không gọi “hoàn toàn miễn phí” khi dùng dịch vụ ngoài.

Jev free không có SLA/free-forever; hạ tầng, email/storage/domain và tool coding là những khoản khác.
Production estimate cần phân rã: storefront RAM/CPU, API RAM/CPU, worker RAM/CPU, PostgreSQL RAM+volume+backup, Redis RAM+volume, network egress, object storage/requests, email, monitoring, domain/tax.
Railway tính theo plan và resource usage [S14]; không cộng base fee hai lần nếu nó đã được tính vào credit/usage theo plan.

**Dải dự phòng để thảo luận:** khoảng40–100USD/tháng cho một cấu hình nhỏ, một môi trường luôn bật; không phải báo giá và có thể lệch đáng kể. Staging bật liên tục, backups lớn, traffic cao hoặc yêu cầu HA có thể tăng. Agent phải đo vài ngày staging và lập dự phóng thực tế trước live. Chưa có khoản nào được owner phê duyệt trong bộ tài liệu.

## 13.5 Phép tính chi phí

Tính theo:
`estimated_monthly = platform_compute_storage_network + external_services + domain_amortized + taxes + contingency`.
Nếu provider model trả phí được duyệt sau này:
`AI_cost = total_input_tokens/1e6 * input_rate + output_tokens/1e6 * output_rate + gateway_fees`.
Không giả tất cả request cùng2k tokens; ghi usage thực, số lượt và fallback.
Production v1 vẫn rules hoặc free-only; công thức không phải quyền chuyển paid.

## 13.6 Chống phát sinh phí

Separate dev/staging/prod keys; disable paid models nếu tài khoản hỗ trợ; tắt auto-reload khi mục tiêu chỉ thử free; đặt quota/app counter và dashboard budget.
Hard caps có thể ngừng dịch vụ, phải owner hiểu; alert không phải hard cap. Không nói “đặt budget là không bao giờ bị trừ thêm” nếu provider không bảo đảm.
Không tạo autoscaling vô giới hạn, persistent preview cho mọi PR hoặc server recovery quên tắt.
Trước subscribe/install cloud add-on, agent phải báo phí, quyền dữ liệu và cách gỡ.

## 13.7 Owner có thể ủy quyền đến đâu

Ghi rõ: môi trường, thời hạn, service, giới hạn tiền, loại thao tác. Ví dụ “được deploy staging trong project đã tạo, không tạo project mới, không đụng production, tối đa20USD phát sinh trong tuần”.
Đừng dùng “toàn quyền mọi thứ” làm mặc định. G9 luôn cần phê duyệt riêng cho tiền/dữ liệu thật.
Phê duyệt chỉ lưu nội dung không-secret ở LAUNCH-APPROVALS, không lưu token/OTP.

## 13.8 Tiêu chí đổi phạm vi

Nếu owner đổi từ phụ kiện sang quần áo, cập nhật metadata/variants/size/returns/UI/tests trước tiếp tục. Nếu muốn online payment, tạo phase2 với merchant onboarding/webhooks/reconciliation.
Agent không tự thêm tính năng monetization/recommendation tracking vì có thể tăng phí và xử lý dữ liệu.
