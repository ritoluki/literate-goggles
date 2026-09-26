import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const origin = 'http://127.0.0.1:3000'
const sessionUrl = origin + '/api/v1/session'
const cartUrl = origin + '/api/v1/cart'
const itemUrl = cartUrl + '/items'

function variantId() {
  const result = spawnSync('docker', [
    'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
    'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c',
    "select id from product_variant where sku='BG-DEMO-01-BLACK' and deleted_at is null limit 1",
  ], { cwd: process.cwd(), encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error('Fixture variant query failed')
  const id = result.stdout.trim()
  assert.match(id, /^variant_[A-Za-z0-9]+$/)
  return id
}

function publishableKey() {
  const result = spawnSync('docker', [
    'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
    'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c',
    "select token from api_key where title like '%Demo Storefront Key' and type='publishable' and deleted_at is null limit 1",
  ], { cwd: process.cwd(), encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error('Publishable key query failed')
  const key = result.stdout.trim()
  assert(key)
  return key
}

async function newSession() {
  const response = await fetch(sessionUrl, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(20_000),
  })
  assert.equal(response.status, 201)
  const cookie = response.headers.get('set-cookie')?.match(/^bg_session=[A-Za-z0-9_-]{43}/)?.[0]
  assert(cookie)
  const body = await response.json()
  return { cookie, csrf: body.data.csrfToken }
}

async function add(session, body, headers = {}) {
  return fetch(itemUrl, {
    method: 'POST',
    headers: {
      origin, cookie: session.cookie, 'content-type': 'application/json',
      'x-bg-csrf-token': session.csrf, ...headers,
    },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  })
}

const empty = await fetch(cartUrl)
assert.equal(empty.status, 200)
assert.equal((await empty.json()).data.items.length, 0)

const a = await newSession()
const variantIdValue = variantId()
assert.equal((await add(a, { variantId: variantIdValue, quantity: 1 },
  { 'x-bg-csrf-token': '' })).status, 403, 'missing CSRF denied')
assert.equal((await add(a, { variantId: variantIdValue, quantity: 1 },
  { origin: 'https://evil.invalid' })).status, 403, 'cross-origin denied')
for (const quantity of [-1, 1.5, 999, 'NaN']) {
  assert.equal((await add(a, { variantId: variantIdValue, quantity })).status, 400)
}
assert.equal((await add(a, { variantId: variantIdValue, quantity: 1, amount: 1 })).status, 400)
const added = await add(a, { variantId: variantIdValue, quantity: 1 })
assert.equal(added.status, 200, 'real Medusa add-to-cart workflow should succeed')
const first = (await added.json()).data
assert.equal(first.currency, 'vnd')
assert.equal(first.items.length, 1)
assert.equal(first.items[0].variantId, variantIdValue)
assert.equal(first.items[0].unitPriceVnd, 199000)
assert.equal(first.subtotalVnd, 199000)
assert.equal(first.totalVnd, 199000)
assert.equal(first.canCheckout, false)
assert.equal(added.headers.get('cache-control'), 'private, no-store')

const recovered = await fetch(cartUrl, { headers: { cookie: a.cookie } })
assert.equal(recovered.status, 200)
assert.equal((await recovered.json()).data.revision, first.revision)

const b = await newSession()
const other = await fetch(cartUrl, { headers: { cookie: b.cookie } })
assert.equal(other.status, 200)
assert.equal((await other.json()).data.items.length, 0, 'other session cannot read cart A')
assert.equal((await add(b, { variantId: variantIdValue, quantity: 1, cartId: 'cart_guess' })).status,
  400, 'browser cartId must not be accepted')
const lineUrl = itemUrl + '/' + first.items[0].lineId
const promotionUrl = cartUrl + '/promotion'
const promotionWrite = (session, method, value, headers = {}) => fetch(promotionUrl, {
  method,
  headers: {
    origin, cookie: session.cookie, 'x-bg-csrf-token': session.csrf,
    ...(method === 'PUT' ? { 'content-type': 'application/json' } : {}),
    ...headers,
  },
  ...(method === 'PUT' ? { body: JSON.stringify(value) } : {}),
  signal: AbortSignal.timeout(30_000),
})
const lineWrite = (session, method, quantity, headers = {}) => fetch(lineUrl, {
  method,
  headers: {
    origin, cookie: session.cookie, 'x-bg-csrf-token': session.csrf,
    ...(method === 'PATCH' ? { 'content-type': 'application/json' } : {}),
    ...headers,
  },
  ...(method === 'PATCH' ? { body: JSON.stringify({ quantity }) } : {}),
  signal: AbortSignal.timeout(30_000),
})
assert.equal((await lineWrite(b, 'PATCH', 2)).status, 404, 'session B cannot update A line')
assert.equal((await lineWrite(b, 'DELETE')).status, 404, 'session B cannot delete A line')
assert.equal((await promotionWrite(b, 'PUT', { code: 'BGDEMO10' })).status, 409,
  'session B has no cart to promote')
assert.equal((await promotionWrite(a, 'PUT', { code: 'BGDEMO10' },
  { 'x-bg-csrf-token': '' })).status, 403)
assert.equal((await promotionWrite(a, 'PUT', { code: 'BGDEMO10', amount: 1 })).status, 400)
assert.equal((await promotionWrite(a, 'PUT', { code: 'INVALIDDEMO' })).status, 409)
assert.equal((await (await fetch(cartUrl, { headers: { cookie: a.cookie } })).json()).data.totalVnd,
  199000, 'unknown promotion cannot alter total')
const promoted = await promotionWrite(a, 'PUT', { code: 'BGDEMO10' })
assert.equal(promoted.status, 200)
const promotedCart = (await promoted.json()).data
assert.deepEqual(promotedCart.promotionCodes, ['BGDEMO10'])
assert.equal(promotedCart.subtotalVnd, 199000)
assert.equal(promotedCart.discountVnd, 19900)
assert.equal(promotedCart.totalVnd, 179100)
assert.equal((await lineWrite(a, 'PATCH', 2, { 'x-bg-csrf-token': '' })).status, 403)
assert.equal((await lineWrite(a, 'PATCH', 11)).status, 400)
const updated = await lineWrite(a, 'PATCH', 2)
assert.equal(updated.status, 200)
const updatedCart = (await updated.json()).data
assert.equal(updatedCart.items[0].quantity, 2)
assert.equal(updatedCart.subtotalVnd, 398000)
assert.equal(updatedCart.discountVnd, 39800)
assert.equal(updatedCart.totalVnd, 358200)
assert.notEqual(updatedCart.revision, first.revision)
const unpromoted = await promotionWrite(a, 'DELETE')
assert.equal(unpromoted.status, 200)
const unpromotedCart = (await unpromoted.json()).data
assert.deepEqual(unpromotedCart.promotionCodes, [])
assert.equal(unpromotedCart.totalVnd, 398000)
const removed = await lineWrite(a, 'DELETE')
assert.equal(removed.status, 200)
const removedCart = (await removed.json()).data
assert.equal(removedCart.items.length, 0)
assert.equal(removedCart.totalVnd, 0)
const raceSession = await newSession()
assert.equal((await add(raceSession, { variantId: variantIdValue, quantity: 1 })).status, 200)
const parallelAdds = await Promise.all([
  add(raceSession, { variantId: variantIdValue, quantity: 5 }),
  add(raceSession, { variantId: variantIdValue, quantity: 5 }),
])
assert.deepEqual(parallelAdds.map((response) => response.status).sort(), [200, 409],
  'locked cart workflow must reject the request that would exceed 10 per variant')
const racedCart = await fetch(cartUrl, { headers: { cookie: raceSession.cookie } })
assert.equal((await racedCart.json()).data.items[0].quantity, 6)
const quotaSession = await newSession()
const serviceKey = process.env.BFF_SERVICE_KEY
assert(serviceKey)
const directHeaders = {
  'x-publishable-api-key': publishableKey(),
  'x-bg-service-key': serviceKey,
  'x-bg-session-token': quotaSession.cookie.slice('bg_session='.length),
}
for (let attempt = 1; attempt <= 20; attempt++) {
  const response = await fetch('http://127.0.0.1:9000/store/bff/cart/promotion', {
    method: 'DELETE', headers: directHeaders, signal: AbortSignal.timeout(20_000),
  })
  assert.equal(response.status, 200, 'cart write denied before quota at attempt ' + attempt)
}
const limited = await fetch('http://127.0.0.1:9000/store/bff/cart/promotion', {
  method: 'DELETE', headers: directHeaders, signal: AbortSignal.timeout(20_000),
})
assert.equal(limited.status, 429, '21st backend cart write must be limited')

const reviewSession = await newSession()
assert.equal((await add(reviewSession, { variantId: variantIdValue, quantity: 1 })).status, 200)
const checkoutAddress = await fetch(origin + '/api/v1/checkout/address', {
  method: 'PUT', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf },
  body: JSON.stringify({ email: 'review-fixture@invalid.example', address: {
    firstName: 'Demo', lastName: 'Review', phone: '+84900000000', countryCode: 'vn',
    province: 'TP Hồ Chí Minh', city: 'TP Hồ Chí Minh', address1: '123 Đường Kiểm thử',
  } }), signal: AbortSignal.timeout(30_000),
})
assert.equal(checkoutAddress.status, 200, 'synthetic address should be accepted for review integration')
const shippingOptions = await fetch(origin + '/api/v1/checkout/shipping-options', {
  headers: { cookie: reviewSession.cookie }, signal: AbortSignal.timeout(30_000),
})
assert.equal(shippingOptions.status, 200)
const option = (await shippingOptions.json()).data.shippingOptions[0]
assert(option?.id)
const shippingSelection = await fetch(origin + '/api/v1/checkout/shipping', {
  method: 'PUT', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf }, body: JSON.stringify({ optionId: option.id }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(shippingSelection.status, 200)
const reviewResponse = await fetch(origin + '/api/v1/checkout/review', {
  method: 'POST', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf }, body: JSON.stringify({ method: 'cod' }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(reviewResponse.status, 200, 'server should create a Medusa COD session and signed review')
const review = (await reviewResponse.json()).data
assert.equal(review.paymentMethod, 'cod')
assert.equal(review.cart.totalVnd, 229000)
assert(!review.reviewToken.includes('review-fixture@invalid.example'), 'signed review token must contain no PII')
const tokenClaims = JSON.parse(Buffer.from(review.reviewToken.split('.')[0], 'base64url').toString())
assert.equal(tokenClaims.currency, 'vnd')
assert.equal(tokenClaims.total, 229000)
assert.equal(tokenClaims.payment, 'cod')
assert(!('email' in tokenClaims) && !('address' in tokenClaims))
assert.notEqual(tokenClaims.sid, reviewSession.cookie.slice('bg_session='.length))
assert.notEqual(tokenClaims.cid, reviewSession.cookie.slice('bg_session='.length))
assert(tokenClaims.exp - tokenClaims.iat <= 5 * 60 * 1000)
const reviewLineId = review.cart.items[0].lineId
const changedLine = await fetch(itemUrl + '/' + reviewLineId, {
  method: 'PATCH', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf }, body: JSON.stringify({ quantity: 2 }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(changedLine.status, 200, 'cart mutation should be applied by authoritative Medusa workflow')
const changedReviewResponse = await fetch(origin + '/api/v1/checkout/review', {
  method: 'POST', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf }, body: JSON.stringify({ method: 'cod' }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(changedReviewResponse.status, 200)
const changedReview = (await changedReviewResponse.json()).data
assert.notEqual(changedReview.reviewToken, review.reviewToken, 'changed cart must get a distinct signed review')
assert.equal(changedReview.cart.totalVnd, 428000, 'updated total must come from Medusa after cart mutation')
const staleComplete = await fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf, 'idempotency-key': randomUUID() },
  body: JSON.stringify({ reviewToken: review.reviewToken }), signal: AbortSignal.timeout(30_000),
})
assert.equal(staleComplete.status, 409, 'old review must not complete after cart mutation')
assert.equal((await staleComplete.json()).error.code, 'CART_CHANGED')
const incompleteSession = await newSession()
assert.equal((await add(incompleteSession, { variantId: variantIdValue, quantity: 1 })).status, 200,
  'incomplete checkout fixture must own a real Medusa cart')
const incompleteComplete = await fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: incompleteSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': incompleteSession.csrf, 'idempotency-key': randomUUID() },
  body: JSON.stringify({ reviewToken: 'synthetic-no-review' }), signal: AbortSignal.timeout(30_000),
})
assert.equal(incompleteComplete.status, 409, 'checkout without address/shipping/payment review must be rejected')
assert.equal((await incompleteComplete.json()).error.code, 'CHECKOUT_INCOMPLETE')
const placeOrderKey = randomUUID()
const secondTabKey = randomUUID()
const completeFromTab = (key, signal = AbortSignal.timeout(45_000)) => fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf, 'idempotency-key': key },
  body: JSON.stringify({ reviewToken: changedReview.reviewToken }), signal,
})
const distinctKeyRace = await Promise.all([completeFromTab(placeOrderKey), completeFromTab(secondTabKey)])
assert(distinctKeyRace.every((response) => [200, 201].includes(response.status)),
  'parallel tabs with different idempotency keys must converge without a duplicate order')
const distinctKeyResults = await Promise.all(distinctKeyRace.map(async (response) => (await response.json()).data))
const placed = distinctKeyResults.find((result) => result.status === 'succeeded')
assert.equal(placed.status, 'succeeded')
assert(placed.orderReference)
assert(distinctKeyResults.every((result) => result.orderReference === placed.orderReference),
  'parallel distinct-key tabs must converge on the same Medusa order')
const successfulIntentKey = [placeOrderKey, secondTabKey][distinctKeyRace.findIndex((response) => response.status === 201)]
const intentStatus = await fetch(`${origin}/api/v1/checkout/complete/${successfulIntentKey}`, {
  headers: { cookie: reviewSession.cookie }, signal: AbortSignal.timeout(20_000),
})
assert.equal(intentStatus.status, 200, 'the owner can poll a completed checkout intent')
assert.equal((await intentStatus.json()).data.orderReference, placed.orderReference)
const foreignIntentStatus = await fetch(`${origin}/api/v1/checkout/complete/${successfulIntentKey}`, {
  headers: { cookie: b.cookie }, signal: AbortSignal.timeout(20_000),
})
assert.equal(foreignIntentStatus.status, 404, 'another session cannot discover an order from an intent key')

const timeoutSession = await newSession()
assert.equal((await add(timeoutSession, { variantId: variantIdValue, quantity: 1 })).status, 200)
const timeoutAddress = await fetch(origin + '/api/v1/checkout/address', {
  method: 'PUT', headers: { origin, cookie: timeoutSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': timeoutSession.csrf }, body: JSON.stringify({ email: 'review-fixture@invalid.example',
    address: { firstName: 'Demo', lastName: 'Timeout', phone: '+84900000000', countryCode: 'vn',
      province: 'TP Há»“ ChÃ­ Minh', city: 'TP Há»“ ChÃ­ Minh', address1: '123 ÄÆ°á»ng Kiá»ƒm thá»­' } }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(timeoutAddress.status, 200)
const timeoutOptionsResponse = await fetch(origin + '/api/v1/checkout/shipping-options', {
  headers: { cookie: timeoutSession.cookie }, signal: AbortSignal.timeout(30_000),
})
assert.equal(timeoutOptionsResponse.status, 200)
const timeoutOption = (await timeoutOptionsResponse.json()).data.shippingOptions[0]
const timeoutShipping = await fetch(origin + '/api/v1/checkout/shipping', {
  method: 'PUT', headers: { origin, cookie: timeoutSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': timeoutSession.csrf }, body: JSON.stringify({ optionId: timeoutOption.id }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(timeoutShipping.status, 200)
const timeoutReviewResponse = await fetch(origin + '/api/v1/checkout/review', {
  method: 'POST', headers: { origin, cookie: timeoutSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': timeoutSession.csrf }, body: JSON.stringify({ method: 'cod' }),
  signal: AbortSignal.timeout(30_000),
})
assert.equal(timeoutReviewResponse.status, 200)
const timeoutReview = (await timeoutReviewResponse.json()).data
const timeoutKey = randomUUID()
const timeoutAttempt = await fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: timeoutSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': timeoutSession.csrf, 'idempotency-key': timeoutKey },
  body: JSON.stringify({ reviewToken: timeoutReview.reviewToken }), signal: AbortSignal.timeout(250),
}).then((response) => response).catch((error) => {
  assert(['TimeoutError', 'AbortError'].includes(error.name), 'completion client timeout must be an abort/timeout')
  return null
})
if (timeoutAttempt) assert([200, 201].includes(timeoutAttempt.status),
  'a completion response arriving before client timeout must be successful')
let timeoutIntentResponse
for (let attempt = 0; attempt < 30; attempt++) {
  timeoutIntentResponse = await fetch(`${origin}/api/v1/checkout/complete/${timeoutKey}`, {
    headers: { cookie: timeoutSession.cookie }, signal: AbortSignal.timeout(20_000),
  })
  if (timeoutIntentResponse.status !== 202) break
  await new Promise((resolve) => setTimeout(resolve, 200))
}
assert.equal(timeoutIntentResponse.status, 200,
  'timed-out completion must settle through owner-scoped intent polling')
const timeoutPlaced = (await timeoutIntentResponse.json()).data
assert(timeoutPlaced.orderReference, 'timed-out owner poll must eventually return the order reference')
const timeoutReplay = await fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: timeoutSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': timeoutSession.csrf, 'idempotency-key': timeoutKey },
  body: JSON.stringify({ reviewToken: timeoutReview.reviewToken }), signal: AbortSignal.timeout(30_000),
})
assert.equal(timeoutReplay.status, 200, 'retry after client timeout must replay, not create another order')
assert.equal((await timeoutReplay.json()).data.orderReference, timeoutPlaced.orderReference)
const replayRequests = await Promise.all(Array.from({ length: 10 }, () => fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf, 'idempotency-key': placeOrderKey },
  body: JSON.stringify({ reviewToken: changedReview.reviewToken }), signal: AbortSignal.timeout(30_000),
})))
assert.deepEqual(replayRequests.map((response) => response.status), Array(10).fill(200),
  'ten concurrent retries for one completed cart should return the existing order')
const replayReferences = await Promise.all(replayRequests.map(async (response) =>
  (await response.json()).data.orderReference))
assert(replayReferences.every((reference) => reference === placed.orderReference))
const payloadMismatch = await fetch(origin + '/api/v1/checkout/complete', {
  method: 'POST', headers: { origin, cookie: reviewSession.cookie, 'content-type': 'application/json',
    'x-bg-csrf-token': reviewSession.csrf, 'idempotency-key': placeOrderKey },
  body: JSON.stringify({ reviewToken: review.reviewToken }), signal: AbortSignal.timeout(30_000),
})
assert.equal(payloadMismatch.status, 409, 'same idempotency key with a different review payload must conflict')
assert.equal((await payloadMismatch.json()).error.code, 'IDEMPOTENCY_CONFLICT')
console.log('PASS checkout review HTTP: guest address, Medusa shipping quote/selection and COD payment session; signed five-minute token binds VND total without PII')
console.log('PASS checkout completion HTTP: stale review rejected; parallel distinct-key tabs converge; client timeout resolves through owner polling/replay; ten parallel same-key replays and payload mismatch guards pass')
console.log('PASS cart HTTP: Medusa VND add/update/remove and 10% promotion; refresh, locked quantity race, CSRF/Origin, isolated sessions, backend 429 quota')
