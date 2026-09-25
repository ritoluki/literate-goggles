# Khởi động dự án và giao việc cho Codex

## Dành cho chủ dự án

Mặc định đã đủ để bắt đầu: shop demo phụ kiện bàn làm việc, tiếng Việt, VND, Next.js + Medusa, thanh toán COD ở bước thử nghiệm, Jev tùy chọn. Chưa cần chọn hết các nhà cung cấp hoặc gửi key ngay.

Tạo thư mục mới, giải nén bộ này vào đó, mở VS Code, mở Codex và gửi `prompts/START-CODEX.txt`. **Không cần import vào một hệ thống đặc biệt**: để file trong workspace và yêu cầu agent đọc. Cơ chế đọc `AGENTS.md` của Codex được mô tả tại [S04]; các file `docs/` vẫn cần agent đọc theo đường dẫn.

Không dán API key vào chat, ảnh chụp, ticket hoặc Git. Đặt key bằng công cụ quản lý secret hoặc file môi trường local đã được ignore; agent kiểm tra có/không, không in giá trị.

## Những mặc định có thể đổi mà không chặn P0

- Tên làm việc: Bàn Gọn. Khi chưa có thương hiệu thật, giữ nhãn demo.
- Hàng mẫu: desk mat, giá đỡ laptop không điện, khay/kẹp dây, sổ/bút. Không bán sản phẩm y tế, hàng số, subscription hoặc marketplace.
- Tiếng Việt; một cửa hàng/một kho demo; VND; phạm vi địa chỉ Việt Nam.
- Guest checkout; chưa xây tài khoản khách trong v1.
- Tư vấn AI có form ngữ cảnh/chips; không phải chatbot tổng quát.
- Không buộc có model sinh văn bản; lời tư vấn dùng template từ dữ liệu thật.
- Production path: Railway cho web/API/worker/database/Redis, object storage tương thích S3 và email giao dịch. Chưa có quyền chi tiền.

Codex ghi các thay đổi vào DECISIONS.md. Đổi ngành hàng/đơn vị tiền sau khi đã có order thật là một thay đổi cần đánh giá, không phải thay label.

## Khi agent hỏi

Chỉ trả lời những gate cần thiết cho giai đoạn đang đến, ví dụ:

```text
G1 môi trường: dùng máy cá nhân Windows 11 + Docker; cho phép cài trong project.
G2 phạm vi: tiếp tục shop demo; chưa bán thật.
G3 AI: dùng key OpenCode Zen đã đặt ở backend .env; chỉ cho phép jev-1.13-free.
G4 staging: chưa phê duyệt chi phí; hoàn thiện local và tài liệu deploy trước.
```

Nếu chưa chốt, nói “giữ mặc định, chưa mở bán/chi tiền”. Agent phải tiếp tục việc độc lập chứ không chặn toàn bộ dự án.

## Khác nhau giữa các lệnh khởi động

`START-CODEX`: bắt đầu từ zero hoặc khảo sát repo hiện tại, thực thi P0 trở đi.  
`CONTINUE-CODEX`: đọc state và tiếp tục task chưa hoàn tất, tránh scaffold lại.  
`RELEASE-CODEX`: chỉ chuẩn bị/triển khai release được phê duyệt; không phải lệnh bỏ mọi bảo vệ.

Không bật quyền shell/cloud không giới hạn để đạt “tự làm hết”. Quyền tối thiểu, thao tác reversible và checkpoint khiến việc tự động hóa đáng tin hơn.

## Môi trường Windows

Agent phải kiểm tra phiên bản Windows hiện tại, không suy từ lần trò chuyện trước. Nếu vẫn dùng build 17763, không mặc định Docker Desktop hiện tại chạy được: đối chiếu [S20]. Không tự cài bản Docker lỗi thời để né tương thích. Hỏi một lần về nâng môi trường được hỗ trợ hoặc dev environment Linux do bạn cấp; đồng thời tiếp tục đặc tả/types/unit tests có thể chạy.

Nếu dùng WSL, đặt repo trong filesystem Linux; mở bằng VS Code Remote WSL. Không trộn node_modules Windows và Linux.

## Kết quả cần thấy sau các mốc

P1: web và API chạy, database/Redis có health check.  
P2: seed lặp lại không nhân đôi; quản trị xem được sản phẩm, tồn kho.  
P4: guest đặt một đơn demo, refresh không mất trạng thái, double-click không tạo hai đơn.  
P5: rules và Jev cùng một interface; rút key/giả lập 429 thì shop vẫn hoạt động.  
P7: staging có HTTPS, backup phục hồi thử được, kiểm thử riêng tư và ownership đạt.  
P8: chỉ mở bán khi đủ thông tin thật và bạn đã phê duyệt.

Các mốc này là tiêu chí tương lai, chưa được thực hiện bởi bộ tài liệu.
