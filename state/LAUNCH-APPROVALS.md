# Phê duyệt mở bán
Mặc định **không có phê duyệt**. Agent không tự ký thay owner.
Approval phải gắn môi trường và release SHA; đổi phạm vi/chi phí/PII cần xác nhận lại.

| Gate | Nội dung xác nhận | Trạng thái | Người/ngày/bằng chứng |
|---|---|---|---|
| G1 | Thay đổi OS/tool hệ thống cần quyền | NOT_GRANTED | — |
| G2 | Thương hiệu/catalog/ảnh thật và quyền sử dụng | NOT_GRANTED | — |
| G3 | Provider AI, key account, terms, free-only, billing controls | NOT_GRANTED | — |
| G4 | Cloud accounts, budget ceiling, alerts, services | NOT_GRANTED | — |
| G5 | Người bán/COD/ship/tax/hóa đơn/địa chỉ | NOT_GRANTED | — |
| G6 | Domain/DNS/sender email/recipients | NOT_GRANTED | — |
| G7 | Pháp lý/privacy/retention/customer support | NOT_GRANTED | — |
| G8 | Release SHA, ngày live, UAT, oncall, RPO/RTO | NOT_GRANTED | — |
| G9 | Thao tác tiền hoặc destructive cụ thể | NOT_GRANTED | — |

G3 không bắt buộc nếu production chạy rules-only. G1/G9 chỉ áp dụng khi thực sự phát sinh.
Không mở preview public thu PII thật trong lúc G5/G7/G8 chưa đạt; access-gate staging, noindex và test-only.

## Release được duyệt
- releaseSha: null
- environment: null
- aiMode: rules
- checkoutLiveApproved: false
- approvedBudgetUsdMonthly: null
- approvedBy/approvedAt: null
- knownRisksAccepted: []
