# 17. Chi tiết triển khai để tránh khoảng trống cho agent

## 17.1 Search/filter toàn tập ở catalog nhỏ

V1 hỗ trợ catalog≤1.000products. Server dùng Medusa SDK/Query chính thức để đọc danh sách eligible published/channel theo pagination, kèm variants/prices/availability đã validate. Không coi limit API trang đầu là toàn catalog.
Có thể dựng snapshot public theo region/channel/currency, TTL≤60giây; quá1000products phải phát cảnh báo/require migration retrieval plan, không silently truncate rồi cho kết quả sai.
Thực hiện filter/sort/pagination **sau** khi tập retrieval đầy đủ. Snapshot không chứa customer-specific prices hoặc PII. Invalidating theo product/price/inventory events; force latest ở cart/checkout.
P0/P2 xác minh field expansions và inventory lookup của SDK; nếu API không trả field, bổ sung query/workflow, không giả `in_stock` tự có.
Query text normalize Unicode NFD, remove combining marks, mapđ→d, lowercase, trim/collapse spaces. So khớp các token trên title/category/tags đã normalize; handle accentless phù hợp. Không search raw SQL interpolation.
Search fulltext nâng cao/vector là phase2 khi đo thấy cần.

## 17.2 Parse tiền có grammar

Form số nguyên VND là nguồn rõ nhất. Parser message chỉ hỗ trợ:
- Số đồng nguyên `300000`, nhóm nghìn chuẩn `300.000`/`1.500.000`.
- Số+unit `300k`, `300 nghìn`, `300 ngàn`, `1 triệu`, `1,5 triệu`, `1.5 triệu`.
- Comparators `dưới`, `ít hơn`, `<` →strict upper: n−1 đồng.
- `tối đa`, `không quá`, `đến`, `<=` →inclusive upper n.
- `từ X đến Y` khi cả hai số có đơn vị rõ/rõ là đồng →inclusive range.
- Giá trị form `maxPriceVnd` luôn inclusive.

Không chấp nhận shorthand mơ hồ `1tr5`, `200-500k` hoặc `1.500` có diễn giải xung đột nếu parser không thể xác định chắc. Hỏi lại, không nhờ model bịa số.
Số âm, zero budget mua hàng, overflow, hai ngân sách xung đột, currency khácVND, combo total đều clarify/reject theo UX.
Không regex greedy lấy điện thoại10chữ số làm budget. Chỉ trích số có cue ngân sách/giá/đơn vị hoặc từ field ngân sách. Ngưỡng max50triệu.
Negation “không màu đen” không thành color=black. Nếu v1 không hỗ trợ excludeColor, yêu cầu người dùng chọn màu được chấp nhận.

Mọi parse ra criteria được hiện dưới dạng chip. Nếu form đã chọn300k nhưng message bảo500k, không override âm thầm; trả clarification conflict.

## 17.3 Candidate construction

Hard predicates ở variant:
`published && channelAllowed && regionPriceExists && sellable && stockAvailable && priceWithinRange && colorAllowed && categoryAllowed`.
Product range giá chỉ dùng card tổng quan; AI xem variant cụ thể. Không lấy product.minPrice để đề xuất variant màu đắt hơn budget.
Giữ private map `candidateKey→{productId,variantId,version}`. State bên ngoài chỉ c01...cNN+allowed fields. Tối đa12variants sau retrieval đầy đủ/ranking; ưu tiên1variant/product trước, chỉ bổ sung variant khác khi cần và có lý do.
Revalidate trước render response và trước add cart. Stock provider lỗi →UPSTREAM_UNAVAILABLE/fallback UI, không giả “không có sản phẩm”.

## 17.4 Reason builder

Nhận server metadata +normalized preferences, xuất enum reason codes rồi map text:
WITHIN_BUDGET khi price≤inclusive bound thực; SMALL_DESK khi metadata.space_fit=small; PORTABLE khi use_cases chứaportable; MATCHES_STYLE khi exact tag; LOWEST_PRICE chỉ khi thật sự min trong eligible set.
Không để model trả reason text tự do làm proof. Thiếu bằng chứng →bỏ lý do, không fabricate.
Lời gợi ý có priceAsOf timestamp nội bộ và chú thích giá/tồn kho kiểm tra lại khi mua.

## 17.5 Provider error taxonomy

Config (`missing_key`, `unapproved`, `model_disallowed`), Availability (`timeout`, `rate_limited`, `overloaded`, `network_error`), Contract (`invalid_json`, `oversized`, `schema_invalid`, `unknown_choice`, `semantic_conflict`), Budget (`daily_cap`, `concurrency_cap`, `quota_store_down`).
Mỗi reason map metric+circuit behavior+UI fallback. Không throw raw exception. Không dùng generic success=true khi fallback.
Usage thiếu thì null/unknown, không ghi0token như đã biết.

## 17.6 Backend identity boundary

Next BFF đọc HttpOnly cookie; gửi service key+opaque session header tới Medusa custom route. Backend hash token, lookup not-expired session, resolve owned cart/order; ignore browser-supplied IDs ngoài line/product/variant cần thao tác có owner check.
Catalog có thể dùng core Store SDK; private write chỉ custom owner-checked routes.
Service middleware phải bao phủ cả raw `/store/carts`/orders endpoints để không tạo bypass. Viết negative tests direct HTTP, không dựa browserCORS.

## 17.7 Review/complete consistency

Review token do backend ký/verify với key riêng (không gửi token-secret sang browser). Payload không có PII: session/cart hash reference, canonical fingerprint, total/currency/method/shipping, exp, nonce, version.
Fingerprint lấy sortedlineitems(id,variant,qty,unitTotal), promotions, shipping option/amount, tax/context và total. Không dùng JSON.stringify object tùy thứ tự không canonical.
Complete:
1. Check origin/CSRF tại BFF; auth service/session tại backend.
2. Claim IdempotencyRequest theo key+hash.
3. Acquire cart lock/framework completion semantics.
4. Nếu CartCompletion succeeded→existing order; processing/reconciling→pending.
5. Verify review expiry/fingerprint/context, recalc/revalidate stock.
6. Ghi durable attempt/workflow transaction pointer trước khi dispatch khi API cho phép.
7. Run core complete workflow; inspect union response.
8. Persist order reference/grant, response snapshot; emit notification via committed order event.
9. Error unknown→reconciling; known validation→failed safe.
10. Always release lock by owner/token/TTL semantics; không unlock người khác.

Không đặt Redis lock như bảo đảm duy nhất exactly-once. Unique durable cart ledger+core workflow+reconciliation mới bảo vệ crash boundaries. Test transaction failures giữa từng mốc.

## 17.8 Emails

Notification event có order ID; worker fetch thông tin tối thiểu sau order commit; render escaped template; stable idempotency key.
Nếu provider có native idempotency, dùng và ghi TTL documented. Queue at-least-once và DB ledger phải phối hợp, không giả một unique row loại bỏ mọi crash-window send duplicates.
Retry bounded; unknown result kiểm tra provider_message_id/status trước resend. Không serverrequest checkout đợi email.

## 17.9 UI request race

Search/advisor áp sequence ID hoặc AbortController để response cũ không ghi đè state mới.
Cart write serialize theo cart, pending line UI chỉ optimistic khi rollback safe. Khi server trả snapshot revision cũ, bỏ/re-fetch; không merge totals bằng phép cộng local.
Checkout button disabled là UX, không phải idempotency control. Route complete phải đúng khi bị gọi10lần ngoài UI.

## 17.10 Safe startup/config

Startup schema validate APP_MODE, URL scheme/host, key presence đúng provider, secrets min32bytes random, allowed model, no placeholder, worker/admin flags phù hợp.
AI key không có→rules, không fail storefront commerce. Production essential secret missing→fail startup. `APP_MODE=live && AI_PROVIDER=mock`→fail.
Runtime flag có DBversion cache≤30giây, env là ceiling; checkout kill switch được backend check mỗi write, không chỉ hide button.
Không tự generate production secret mới mỗi boot vì làm vô hiệu session/token và khiến replicas khác nhau.

## 17.11 Test fixtures/versioning

Fixtures đều synthetic, seed keys stable. Bất kỳ đổi schema phải version; test adapter không dùng raw fixture as official payload.
Response model sample không phải live captured; live trace phải được khử dữ liệu và gắn provenance.
Maintain trace FR→task→AT/unit test→evidence; code change đổi contract cần update types/schema/sample/tests cùng commit.

## 17.12 Quy tắc chọn khi gặp chi tiết chưa ghi

Giải pháp nhỏ nhất thỏa AC; tái sử dụng framework; tránh paid dependency; ưu tiên reversible và typed interface. Ghi ADR nếu ảnh hưởng architecture hoặc operations.
Chỉ escalate khi scope, business semantics, privacy/cost hoặc irreversible behavior thay đổi. Thiếu một tên SDK là việc agent tra docs, không phải câu hỏi cho chủ dự án.
