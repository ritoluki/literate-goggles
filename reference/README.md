# Smoke test Jev độc lập — không cần scaffold shop
Reference chạy Node20+ với built-in modules; không cài npm package. Đây không phải provider production.

## Offline — không mạng, không key
Từ root bộ tài liệu:
```sh
node reference/jev-smoke.mjs --fixture
node --test reference/jev-smoke.test.mjs
```
Mặc định không có flag cũng chạy fixture. Output ghi rõ `synthetic-fixture` và `liveVerified:false`.

## Live — chỉ sau owner duyệt
Owner đặt `OPENCODE_API_KEY` qua secret env, không dán vào prompt.
Xác nhận tài khoản/key hỗ trợ model free và billing controls; `ALLOW_LIVE_JEV_TEST=1` chỉ là chốt opt-in cho script, không chứng minh provider chắc chắn miễn phí.
Cách local với Node có hỗ trợ `--env-file` (Node20.6+; baseline dự án là24 LTS):
Tạo `.env.jev.local` bằng editor trên máy, file này đã bị `.gitignore` loại trừ:
```dotenv
OPENCODE_API_KEY=YOUR_KEY_HERE
ALLOW_LIVE_JEV_TEST=1
```
Chạy:
```sh
node --env-file=.env.jev.local reference/jev-smoke.mjs --live
```
Thay placeholder bằng key thật chỉ trong file local, không gửi key vào chat, không commit file.
Kiểm tra `git check-ignore .env.jev.local` trước khi lưu secrets trong một repo đã thay `.gitignore`.
Xóa file nếu không cần giữ key local; dùng secret manager cho production.
Script chỉ có1request, không retry, timeout5giây cho smoke, request model cố định`jev-1.13-free`, endpoint cố định.
HTTP/schema failure → nonzero exit; không tự thay model. Không in key, raw body hoặc raw upstream error.

## Giới hạn
Không global quotas, không session/CSRF, không commerce validation, không distributed breaker.
Output fixture không phải xác suất thực; live result đúng schema cũng không chứng minh chất lượng tư vấn.
Gateway có thể đổi contract; báo lỗi rồi verify docs chính thức, không nới schema để che lỗi.
Application adapter dùng deadline1500ms + controls trong docs/06, không dùng timeout5giây của reference làm production default.
