# Cấu hình / release
Các env trong đây là **hợp đồng tên biến dự kiến**, không phải bảo đảm Medusa tự hiểu chúng.
Agent viết config mapping, startup validation và cập nhật docs theo implementation.
Không copy production secrets vào repo/chat. Generate secret ngẫu nhiên đủ dài vào local env ignored hoặc nhập qua dashboard secrets.
Review signing secret thuộc backend; storefront chỉ giữ BFF service/CSRF secret cần thiết.
Backend API và worker dùng cùng module config/DB/Redis; API mode/server và worker mode/disable admin theo phiên bản Medusa thực.
Không dùng `MEDUSA_WORKER_MODE=shared` cho production tách server/worker.
Một env `REDIS_URL` không đủ nếu framework còn dùng module in-memory: phải cấu hình/test infrastructure modules production.
Tách staging/live secrets, storage, databases và email recipients.
Release manifest template không phải approval. Agent chỉ điền `true` với bằng chứng và owner approval đúng phạm vi.
