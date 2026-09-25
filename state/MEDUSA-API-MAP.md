# Bản đồ API Medusa — agent phải hoàn tất bằng installed version
Các hàng có trạng thái PASS đã được xác minh trên Medusa 2.21.1 cài trong application. Hàng TBD vẫn chưa được xem là đã tích hợp.

## Trạng thái P2/T008

Runtime local đã có PostgreSQL, Redis và Medusa 2.21.1. T008 xác minh context VND, sales channel, calculated price và availability bằng Remote Query thật; Store API yêu cầu publishable key gắn đúng sales channel.

| Use case | Version + official URL | Route/SDK/workflow + import | Fields/body/response/error | Auth/idempotency/recovery | Test/evidence |
|---|---|---|---|---|---|
| region/channel/currency context | Medusa 2.21.1; official publishable-key and Store API docs | `GET /store/regions`; `GET /store/products`; internal `query.graph({ entity: "region" / "sales_channel" })`; seed uses `createRegionsWorkflow`, `createSalesChannelsWorkflow`, `createApiKeysWorkflow`, `linkSalesChannelsToApiKeyWorkflow` from `@medusajs/medusa/core-flows` | Region `Vietnam Demo`, `currency_code=vnd`, country `vn`; channel `Bàn Gọn Storefront (Demo)`; publishable key linked to channel | Store routes require `x-publishable-api-key`; key supplies allowed sales-channel context; region remains server-selected by ID/config | PASS — `pnpm --dir apps/backend run verify:commerce-context` |
| catalog pagination + variants | Medusa 2.21.1; official Store Products docs | `GET /store/products?limit=&offset=&region_id=&fields=*variants.calculated_price,+variants.inventory_quantity,+metadata,+categories`; internal route uses `query.index` when index feature is on, otherwise `query.graph` | Response `{products,count,estimate_count?,offset,limit}`; extra fields must be allowlisted; application adapter must still exclude draft/wrong-channel/no-price before pagination | Publishable key required. Installed route derives `sales_channel_id` from key middleware and pricing context from `region_id`/currency | PARTIAL_PASS — Remote Query verified 21 published storefront fixture products/42 variants; HTTP adapter/filter-before-pagination belongs T011 |
| prices calculated for VND/region | Medusa 2.21.1; official product pricing examples | Remote Query field `variants.calculated_price.*` with `context.variants.calculated_price = QueryContext({ region_id, currency_code: "vnd" })`; Store route builds the same context from `req.pricingContext` | Use `calculated_amount` and `currency_code`; do not read a base price or accept client amount. Runtime assertion found calculated VND prices | Region ID is server config/input validated against demo region; channel comes from publishable key | PASS — runtime script asserts every priced fixture variant returned currency `vnd` |
| inventory availability/reservation | Medusa 2.21.1; official variant inventory guide | `getVariantAvailability(query, { variant_ids, sales_channel_id })` from `@medusajs/framework/utils`; Store product fields may request `+variants.inventory_quantity` | Availability map keyed by variant ID; app treats missing/error as unavailable. Reservation APIs remain TBD for cart/order task | Sales-channel ID is mandatory so linked stock locations are applied; no raw client stock override | PASS for read availability — 42/42 variant IDs returned and at least one positive; reservation NOT_RUN |
| cart create + recover current | TBD | TBD | TBD | TBD | NOT_RUN |
| line add/update/remove | TBD | TBD | TBD | TBD | NOT_RUN |
| promotion apply/remove | TBD | TBD | TBD | TBD | NOT_RUN |
| address/email update | TBD | TBD | TBD | TBD | NOT_RUN |
| shipping options/quote/select | TBD | TBD | TBD | TBD | NOT_RUN |
| COD provider registration/session | TBD | TBD | TBD | TBD | NOT_RUN |
| complete cart + error payload | TBD | TBD | TBD | TBD | NOT_RUN |
| cart→order recovery after commit | TBD | TBD | TBD | TBD | NOT_RUN |
| order query through owner grant | TBD | TBD | TBD | TBD | NOT_RUN |
| order event/subscriber retries | TBD | TBD | TBD | TBD | NOT_RUN |
| product/price/inventory invalidation | TBD | TBD | TBD | TBD | NOT_RUN |
| production Redis lock/cache/workflow | TBD | TBD | TBD | TBD | NOT_RUN |
| S3 file provider/upload controls | TBD | TBD | TBD | TBD | NOT_RUN |
| notification provider interface | TBD | TBD | TBD | TBD | NOT_RUN |
| admin auth/role/capture/fulfillment | TBD | TBD | TBD | TBD | NOT_RUN |

Đặc biệt verify framework workflow recovery: không bịa lookup transaction/order, không tạo order riêng bằng ORM để né vấn đề.
Route gốc /store và custom endpoints đều phải được bảo vệ theo docs/07, không chỉ bảo vệ BFF.
