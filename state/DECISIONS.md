# Quyết định và giả định

## Mặc định đã có trong đặc tả, agent không cần hỏi lại cho local
| ID | Quyết định mặc định | Tình trạng |
|---|---|---|
| D01 | Một shop demo phụ kiện góc làm việc, tên tạm Bàn Gọn | DEFAULT_NOT_REAL_BRAND |
| D02 | Next.js + Medusa v2, monorepo TypeScript/pnpm | DEFAULT |
| D03 | Việt ngữ, VND, một region/kho, guest checkout | DEFAULT |
| D04 | COD demo; chưa tích hợp online payment/carrier | DEFAULT |
| D05 | RulesProvider trước; Jev read-only tùy chọn | DEFAULT |
| D06 | Chỉ model jev-1.13-free; không paid fallback | HARD_LIMIT |
| D07 | Railway staging/live, R2 assets, email adapter | PROPOSED_NOT_PURCHASED |
| D08 | Tự dựng UI theo docs/02, không chờ Figma | DEFAULT |
| D09 | Không dùng dữ liệu/code/tài khoản dự án công ty | HARD_LIMIT |
| D10 | Không bật nhận đơn thật trước G8 | HARD_LIMIT |

## Owner decisions
Chưa có owner approval nào được ghi nhận. “OK làm tài liệu” không phải duyệt chi tiền hoặc mở bán.
Ghi quyết định thật với ngày, phạm vi, người duyệt, giới hạn; không lưu bí mật trong file.

| ID/gate | Câu hỏi cụ thể | Quyết định của owner | Bằng chứng | Có hiệu lực đến |
|---|---|---|---|---|
| — | Chưa hỏi | NOT_GRANTED | — | — |

## ADR
ADR cần thiết khi thay nền tảng, ranh giới auth, chính sách money, provider hoặc quy mô retrieval; không cần ADR cho mọi component CSS.
Dùng `templates/ADR.md`, đặt file trong `docs/adr/`, link ở đây.
