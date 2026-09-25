# 06. Tích hợp Jev — đơn giản, có giới hạn, thay được

## 6.1 Điều đã xác minh và điều chưa xác minh

Ngày 21/09/2026, tài liệu OpenCode Zen liệt kê `jev-1.13-free` tại `https://opencode.ai/zen/v1/systemone`, dùng Bearer API key và ghi miễn phí **có thời hạn** [S01]. TypeSafe mô tả request `model/state/questions` và response `answers`, với Choice trả lựa chọn/phân phối xác suất/confidence [S02].

Chưa gọi bằng key của chủ dự án; chưa kiểm chứng entitlement, quota, billing thực tế hoặc chất lượng trên catalog này. Không cam kết free luôn còn. Không sử dụng nguồn `jevtypesafe.org` làm nguồn chuẩn; dùng docs chính thức [S01–S03].

Các URL provider không được nhận từ browser. `opencode/<id>` là cách định danh trong một số cấu hình công cụ, không tự động là `model` field HTTP. Adapter này gửi đúng `jev-1.13-free`.

## 6.2 Vai trò giới hạn

Jev chỉ được:
1. Chọn hiển thị gợi ý hoặc hỏi thêm một tiêu chí còn thiếu.
2. Chọn một variant ưu tiên trong tối đa 12 ứng viên hợp lệ.
3. Chọn trường muốn làm rõ từ allowlist.

Jev không được retrieve DB, thực thi SQL/URL, thêm giỏ, tạo đơn, sửa giá, phát voucher hay xử lý PII. Model không thay parsing số tiền hoặc stock validation.

## 6.3 Pipeline một lượt

A. Validate request; giới hạn độ dài; giải session; enforce rate limit.  
B. Hợp nhất form và parser có grammar. Form explicit ưu tiên; xung đột phải hỏi lại. Raw message chỉ tồn tại tạm trong tiến trình, không log/forward.  
C. Normalize criteria; các tiêu chí mơ hồ quan trọng (đơn vị tiền, tổng combo hay mỗi món) → hỏi ngay, bỏ qua provider.  
D. Retrieve toàn bộ tập khả dụng theo context, áp hard constraints bằng code. Nếu không có kết quả: no_match, không gọi Jev.  
E. Rank sơ bộ bằng rules, chọn ≤12 variant, ưu tiên đa dạng product. Candidate fields chỉ gồm IDs tạm/công khai và thuộc tính allowlist, không full HTML.  
F. Nếu provider unavailable/disallowed/quota → RulesProvider. Nếu khả dụng → một request Jev; không retry đồng bộ.  
G. Parse và kiểm tra cấu trúc + cross-field semantics + membership. Low confidence/malformed/inconsistent → rules/clarify, không dùng output mù.  
H. Revalidate selected variants khi dựng response; tạo lý do từ data; trả tối đa3 products khác nhau. Khi user thêm giỏ, commerce validation chạy lại.  
I. Ghi metric đã khử định danh/raw content.

Không xây vòng agent gọi nhiều tool. Mỗi click tư vấn chỉ tối đa một upstream request, trừ người dùng chủ động gửi lượt mới.

## 6.4 Hard/soft constraints

Hard: currency/region/channel, published, sellable variant, stock, maxPrice/minPrice, màu khi khách yêu cầu chắc chắn, category explicit. Không bao giờ tự nới hard constraint.
Soft: minimal/portable/small-desk/gift/organize… dựa metadata.
Nếu “rẻ nhất” là yêu cầu explicit, code sort giá trực tiếp; không cần Jev chọn lại.
Nếu user nói “cả bộ dưới500k”, v1 hỏi lại ngân sách mỗi món; không trả ba sản phẩm mỗi món400k rồi gọi là phù hợp tổng500k.

## 6.5 Baseline RulesProvider

Tính điểm ứng viên: useCase match +4; style match +2; spaceFit match +2; prefer current selected category +1 nếu category không hard. Không dùng margin/lợi nhuận shop làm tiêu chí ẩn.
Tiebreak: giá tăng dần → product handle → variant ID ổn định. Hard criteria xử lý trước score. Kết quả tối đa3 sản phẩm khác nhau; variant khác màu của cùng product không chiếm cả3 slots.
Nếu thiếu category và không có đủ mục đích xác định: hỏi category một lần. Sau tối đa2 lượt clarify, hiện kết quả rộng có nhãn rõ hoặc form cho người dùng chỉnh, không hỏi vô tận.

## 6.6 State gửi ra ngoài

Chỉ gửi:
- Criteria đã normalize từ enum/số tiền; không lịch sử mua/PII.
- Candidacy ID ngắn `c01`…`c12` map nội bộ về variant thật.
- Category/color/price/currency và tags mô tả đã allowlist.
- Danh sách field còn thiếu, số lần hỏi đã dùng và giới hạn action.

Không gửi raw câu người dùng. Không gửi tên/điện thoại/email/địa chỉ/cartId/orderId/sessionToken/IP/userAgent. Không gửi title/mô tả tự do từ merchant nếu không cần; dùng thuộc tính đã chuẩn hóa để giảm prompt injection.

Những preferences này vẫn được nêu trong thông báo riêng tư và xử lý provider được chủ shop phê duyệt. Không hứa “không có dữ liệu cá nhân” chỉ nhờ regex; chính allowlist làm ranh giới.

## 6.7 Wire request

Schema provider tham chiếu [S02]; file `contracts/jev.request.example.json` là payload ví dụ tự soạn cho dự án, không phải kết quả thực nghiệm. `state` dùng chuỗi JSON stringify để giảm khác biệt gateway.

Map `questions` gồm:
- `next_action`: choice `SHOW_RECOMMENDATIONS | ASK_CLARIFY`;
- `primary_candidate`: choice `c01...cNN | NONE`;
- `clarify_field`: choice các field còn thiếu `categoryKey|useCase|style|NONE`.

Mỗi câu hỏi phải có instructions đủ nghĩa; không trông đợi model đọc tên key để hiểu nhiệm vụ. Các câu hỏi được đánh giá độc lập [S03]; không giả question2 biết đáp án question1.
Nếu không có field thiếu, không cho ASK_CLARIFY; có thể bỏ luôn next_action/clarify_field và chỉ hỏi primary. Adapter/validator phải biết chính xác bộ questions đã gửi.

## 6.8 Kiểm tra response

Yêu cầu JSON bounded, model string, answers có đúng question cần thiết. Với choice:
- type=choice; choice là một key trong criteria vừa gửi.
- probabilities có đúng các keys allowlist, không NaN/Infinity, mỗi số0–1; tổng sai lệch≤0.02; không tự “sửa” response sai lớn.
- choice có xác suất lớn nhất (chấp nhận tie với epsilon1e-6).
- confidence hữu hạn0–1; lưu riêng, không đồng nhất với xác suất option.
- Bỏ qua field meta vô hại ngoài schema bằng adapter đã review; không thực thi hoặc forward chúng.

Semantic: SHOW cần primary hợp lệ không NONE. ASK cần field thực sự thiếu và số lượt<2. Output mâu thuẫn →fallback. Không vì primary probability cao mà bỏ qua hard validation.

Ngưỡng khởi đầu do dự án đặt: topProbability≥0.60 và top1−top2≥0.15 cho primary. Dưới ngưỡng →rules; nếu thật sự thiếu tiêu chí có thể clarify. Đây là heuristic cần eval, **không phải guarantee xác suất đúng**. Không show số này cho người mua như “độ phù hợp”.

## 6.9 Giới hạn khởi đầu

| Giới hạn dự án | Mặc định |
|---|---|
| raw message | tối đa500ký tự và2KiB |
| candidate | tối đa12 |
| toàn request upstream | tối đa16KiB UTF-8 |
| response đọc | tối đa64KiB |
| deadline upstream | 1500ms |
| upstream concurrency toàn app |4 |
| lượt upstream/session |8/phút,30/ngày |
| upstream toàn môi trường |1000/ngày |
| retry đồng bộ |0 |
| circuit breaker |5lỗi/60giây →mở60giây |
| số clarify/lượt tìm |2 |
| paid fallback |cấm |

Counter toàn app atomic trong Redis, không Map in-memory khi nhiều replica. Redis quota unavailable →tắt upstream, rules vẫn chạy nếu commerce đủ khỏe.
401/403/model_missing →disable provider và alert; không retry đến hết quota.
429/529/5xx/timeout →fallback, respect cooldown; không flood provider bằng retry. Chỉ probe phục hồi theo budget sau cooldown.
Body quá lớn/truncated/HTML/quota-page trả HTTP200 →response invalid, không báo success.

## 6.10 Free-only gate

`AI_PROVIDER=rules` mặc định. Bật Jev cần owner xác nhận key/terms/billing và cấu hình server `AI_PROVIDER_APPROVED=true`.
Allowlist request model duy nhất `jev-1.13-free`; thiếu model không được xóa `-free`. Không đọc base URL từ user. Không auto-enable paid provider nếu giá thấp.
Trước bật và trước release: kiểm tra docs, model list và quyền workspace; ghi checked_at. Kiểm tra lại availability định kỳ có giới hạn, không gọi API paid chỉ để kiểm tra. Nếu thông tin free không còn xác nhận được, về rules.
Owner tắt auto-reload/khóa model trả phí hoặc đặt giới hạn phù hợp trong tài khoản; code app không kiểm soát được mọi cơ chế billing của provider.
`$0 AI` không có nghĩa hosting/database/email/domain miễn phí.

## 6.11 Interface và thay provider

`DecisionProvider.decide(input, signal)` trả union `DecisionSuccess|DecisionUnavailable`, không throw raw network errors lên UI.
Thư mục providers chỉ có `rules`, `opencode-jev`, `mock`. Adapter TypeSafe trực tiếp/LLM khác để phase2, không tự implement hoặc cấp key bây giờ.
Không bắt buộc SDK Jev; Node fetch server-side đủ cho wire schema nhỏ. Nếu chọn SDK, phải kiểm tra retries mặc định/timeout và bundle chỉ server.

## 6.12 Lời giải thích

Reason codes: `WITHIN_BUDGET`, `MATCHES_USE_CASE`, `SMALL_DESK`, `PORTABLE`, `MATCHES_STYLE`, `IN_STOCK`, `LOWEST_PRICE`.
Code chỉ xuất khi dữ liệu thực hỗ trợ. Templates nằm source, test snapshot; không trả lời loại “nâng hiệu suất30%” nếu metadata chỉ là desk mat.
User yêu cầu ngoài scope →chỉ dẫn form/catalog hoặc liên hệ; không gọi LLM để “cứ trả lời cho được”.

## 6.13 Đánh giá trước live

Dùng `fixtures/ai.eval-cases.jsonl` (đã có60ca synthetic) làm seed, bổ sung ca chất lượng theo catalog.
`allowedVariantSeedKeys` chỉ kiểm chứng tập eligible, không thay nhãn top1 chất lượng;
phải gán `acceptableTop1SeedKeys` có review trước tính accuracy85%. Tách train/tune và holdout (ít nhất20ca không dùng chỉnh threshold); labels do team review, có thể chấp nhận nhiều IDs.
Đo hard violation, top1 acceptable, fallback rate, clarification appropriateness, p50/p95 latency và upstream calls. Rules là baseline; Jev có thể không tốt hơn.
Mock dùng kiểm thử fault/schema, không dùng đo chất lượng model. Chạy live eval phải được owner cấp quyền/API, có giới hạn chi phí và không dùng PII.
Nếu chưa chạy live: ghi LIVE_EVAL_NOT_RUN và giữ rules ở production, vẫn có thể mở shop khi các gate commerce đạt.

## 6.14 Smoke test

`reference/jev-smoke.mjs` chỉ thử phân loại một tình huống synthetic; có chế độ fixture mặc định và yêu cầu cờ `--live` + xác nhận env mới gọi mạng.
Nó không phải implementation production: chưa có distributed quota, observer, session hay orchestration. Dùng để kiểm tra key/schema sau P0, không copy nguyên vào BFF rồi gọi là production-ready.
