import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:3000/api/v1/catalog'
const get = (query) => fetch(base + query, { signal: AbortSignal.timeout(15_000) })

const first = await get('?page=1&limit=12')
assert.equal(first.status, 200)
assert.equal(first.headers.get('cache-control'), 'no-store')
const firstBody = await first.json()
assert.equal(firstBody.data.total, 20)
assert.equal(firstBody.data.products.length, 12)
assert.match(firstBody.requestId, /^[0-9a-f-]{36}$/)

const second = await get('?page=2&limit=12')
assert.equal(second.status, 200)
assert.equal((await second.json()).data.products.length, 8)
const invalid = await get('?sort=unsafe')
assert.equal(invalid.status, 400)
assert.equal((await invalid.json()).error.code, 'INVALID_CATALOG_QUERY')

const handle = firstBody.data.products[0].handle
const detailResponse = await fetch(`http://127.0.0.1:3000/api/v1/products/${encodeURIComponent(handle)}`, {
  signal: AbortSignal.timeout(15_000),
})
assert.equal(detailResponse.status, 200)
assert.equal(detailResponse.headers.get('cache-control'), 'no-store')
const detailBody = await detailResponse.json()
assert.equal(detailBody.data.handle, handle)
assert.match(detailBody.requestId, /^[0-9a-f-]{36}$/)
assert(detailBody.data.variants.length > 0)
const missingDetail = await fetch('http://127.0.0.1:3000/api/v1/products/not-a-real-product', {
  signal: AbortSignal.timeout(15_000),
})
assert.equal(missingDetail.status, 404)
console.log('PASS catalog BFF: same-origin list/detail no-store, pagination, invalid query/handle denied')
