# Bàn Gọn Commerce — Bộ đặc tả giao Codex triển khai

**Phiên bản tài liệu:** 1.0 · **Ngày kiểm chứng nguồn:** 21/09/2026  
**Loại bàn giao:** đặc tả triển khai + hợp đồng nội bộ + dữ liệu giả lập + quy trình kiểm chứng.
**Không phải:** ứng dụng đã viết xong, một lần triển khai đã được kiểm thử, hay cam kết API miễn phí vĩnh viễn.

## Kết quả cần xây

Một website thương mại điện tử tiếng Việt, bán phụ kiện góc làm việc, với Next.js storefront, Medusa v2 backend/admin, PostgreSQL, Redis và bộ tư vấn chọn sản phẩm có thể dùng Jev qua OpenCode Zen. Khách vẫn tìm sản phẩm, thêm giỏ và đặt hàng khi AI bị tắt.

“Bàn Gọn”, ngành hàng, hình ảnh và catalog đi kèm là **mặc định minh họa có thể thay**, không phải thương hiệu hoặc hàng hóa thật do chủ dự án đã xác nhận. Không xuất bản thông tin người bán, điều khoản, giá bán thật hay cam kết giao hàng giả.

## Bắt đầu

1. Giải nén **nội dung thư mục này** vào thư mục dự án mới, ví dụ `C:\ban-gon-commerce`. Không đặt vào repository công việc.
2. Mở chính thư mục đó bằng VS Code. `AGENTS.md` phải ở root mà Codex làm việc.
3. Mở `START_HERE.md`, đọc phần dành cho chủ dự án, rồi copy nội dung `prompts/START-CODEX.txt` vào Codex.
4. Codex bắt đầu P0. Chưa cần đưa API key, mua domain hoặc đăng ký hosting để làm các phần không phụ thuộc những thứ đó.
5. Khi đổi phiên làm việc, dùng `prompts/CONTINUE-CODEX.txt`. Không yêu cầu agent “đọc lại mọi file” sau mỗi lần.

## Đường triển khai mặc định

`P0 kiểm tra môi trường → P1 nền tảng → P2 commerce → P3 storefront → P4 checkout → P5 AI → P6 hardening → P7 staging → P8 production → P9 theo dõi sau phát hành`

Chỉ một repository. Không bắt buộc Figma, MCP, LLM sinh văn bản, vector database, browser agent hoặc microservice AI. Agent dựng UI từ đặc tả màn hình và kiểm chứng bằng trình duyệt.

## Ba mức hoàn thành khác nhau

- **LOCAL_READY:** chạy trên máy/dev environment; dữ liệu demo; tất cả kiểm thử offline cốt lõi đạt.
- **STAGING_READY:** môi trường triển khai riêng có HTTPS; kiểm thử end-to-end, lỗi nhà cung cấp, backup/restore và các ranh giới bảo mật đạt. Chưa được nhận đơn thật.
- **LIVE_APPROVED:** chủ dự án chấp thuận rõ việc mở bán; thông tin người bán, catalog thật, phí giao hàng, thuế, chính sách, vận hành, ngân sách và quyền truy cập đã xác nhận. Agent không được tự nâng mức này.

Production là một trạng thái có bằng chứng, không phải chỉ là một URL mở được.

## Bản đồ đọc

| File | Mục đích |
|---|---|
| `AGENTS.md` | Quyền tự chủ, điều cấm, thứ tự đọc, điều kiện dừng |
| `START_HERE.md` | Cách giao việc và cách trả lời các chốt cần người |
| `docs/00-product-brief.md` | Mục tiêu, phạm vi, giả định |
| `docs/01-requirements.md` | Yêu cầu chức năng có mã truy vết |
| `docs/02-ui-ux.md` | UI, design tokens, hành vi từng màn hình |
| `docs/03-architecture.md` | Kiến trúc, repository, ranh giới dữ liệu |
| `docs/04-data-and-commerce.md` | Dữ liệu, giá, tồn kho, cart/order/payment |
| `docs/05-api-contracts.md` | Hợp đồng BFF riêng của dự án |
| `docs/06-ai-jev.md` | Vai trò Jev, wire contract, fallback, đánh giá |
| `docs/07-security-privacy.md` | Bảo mật, riêng tư, chống lạm dụng |
| `docs/08-test-plan.md` | Ma trận kiểm thử và ngưỡng chất lượng |
| `docs/09-local-setup.md` | Từ thư mục rỗng đến app local |
| `docs/10-delivery-plan.md` | Các phase, phụ thuộc, tiêu chí hoàn thành |
| `docs/11-production-deployment.md` | Đường deploy chuẩn, rollback, migration |
| `docs/12-operations-runbooks.md` | Backup, sự cố, quan sát, vận hành |
| `docs/13-cost-and-human-gates.md` | Những việc chủ dự án phải quyết/làm |
| `docs/14-acceptance-and-launch.md` | Nghiệm thu và go/no-go |
| `docs/15-sources.md` | Nguồn gốc, trạng thái kiểm chứng, cách cập nhật |
| `docs/16-admin-operations.md` | Chủ shop xử lý sản phẩm, đơn và COD |
| `docs/17-implementation-details.md` | Các thuật toán/ràng buộc cần viết chính xác |
| `state/` | Tiến độ và bằng chứng sống do Codex cập nhật |
| `contracts/` | Types/JSON mẫu nội bộ; không giả danh API Medusa |
| `fixtures/` | Catalog và bộ ca đánh giá giả lập |
| `reference/` | Smoke test Jev độc lập, không phải app production |
| `ops/` | Mẫu biến môi trường và manifest release |
| `prompts/` | Lệnh khởi động/tiếp tục/release |
| `templates/` | ADR, phase report, quyết định và sự cố |

## Nguyên tắc chống hiểu nhầm

File trong `contracts/`, `fixtures/`, `reference/`, `ops/` là đầu vào và mẫu. Agent phải triển khai, chạy kiểm thử và lưu bằng chứng trước khi coi là khả dụng. API bên ngoài phải đọc tài liệu đúng phiên bản; không tự đặt tên hàm SDK. Các ngưỡng hiệu năng, retention và quota trong bộ này là **mục tiêu/giới hạn thiết kế**, không phải kết quả đã đo hay giới hạn được nhà cung cấp bảo đảm.

Tài liệu quyết định “xây cái gì và kiểm chứng thế nào”. Nó không loại bỏ yêu cầu đăng nhập, cấp quyền, thanh toán dịch vụ hoặc phê duyệt mở bán của con người.

## Kiểm tra bộ tài liệu, không cần ứng dụng
Có thể chạy `node scripts/verify-kit.mjs` và `node --test reference/jev-smoke.test.mjs`.
Hai lệnh này chỉ kiểm tra cấu trúc fixture/reference offline; không chứng minh shop, Medusa hoặc API key đã hoạt động.
`DELIVERY-REPORT.md` ghi bằng chứng soạn bộ tài liệu. `KIT_MANIFEST.json` lưu fingerprint bản bàn giao gốc;
sau khi Codex sửa state/spec hợp lệ, fingerprint gốc không còn là kiểm tra tương đương nội dung mới.
