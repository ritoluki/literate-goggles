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
console.log('PASS catalog BFF: same-origin 20 products, 12+8 pages, no-store, invalid query denied')
