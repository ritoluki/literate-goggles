import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

function localPublishableKey(titleSuffix) {
  const sql = `select token from api_key where type='publishable' and deleted_at is null and revoked_at is null and title like '%${titleSuffix}' limit 1`
  const result = spawnSync('docker', [
    'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
    'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c', sql,
  ], { encoding: 'utf8', cwd: process.cwd() })
  if (result.error || result.status !== 0) throw new Error('Could not read local publishable key')
  const key = result.stdout.trim()
  if (!key.startsWith('pk_')) throw new Error('Missing local publishable key')
  return key
}

const demoKey = localPublishableKey('Demo Storefront Key')
const starterKey = localPublishableKey('Default Publishable API Key')
const base = 'http://127.0.0.1:9000/store/catalog-v1'
const serviceKey = process.env.BFF_SERVICE_KEY
if (!serviceKey) throw new Error('BFF_SERVICE_KEY is required for catalog HTTP check')
const get = (path, key, includeService = true) => fetch(base + path, {
  headers: {
    ...(key ? { 'x-publishable-api-key': key } : {}),
    ...(includeService ? { 'x-bg-service-key': serviceKey } : {}),
  },
  signal: AbortSignal.timeout(30_000),
})

const good = await get('?page=1&limit=12', demoKey)
assert.equal(good.status, 200, 'demo catalog should be available')
const catalog = await good.json()
assert.equal(catalog.total, 20)
assert.equal(catalog.products.length, 12)
assert(catalog.products.every((product) =>
  Number.isSafeInteger(product.priceRangeVnd.min) &&
  product.priceRangeVnd.min <= product.priceRangeVnd.max
))
assert(catalog.products.every((product) => product.demo))

const page2 = await get('?page=2&limit=12', demoKey)
assert.equal(page2.status, 200)
assert.equal((await page2.json()).products.length, 8)
const badSort = await get('?sort=unsafe', demoKey)
assert.equal(badSort.status, 400)
const wrongChannel = await get('', starterKey)
assert.equal(wrongChannel.status, 403)
const noKey = await get('')
assert(noKey.status >= 400 && noKey.status < 500)
const direct = await get('', demoKey, false)
assert.equal(direct.status, 403, 'publishable key alone must not bypass BFF')

const detailBase = 'http://127.0.0.1:9000/store/products-v1/'
const detailResponse = await fetch(detailBase + encodeURIComponent(catalog.products[0].handle), {
  headers: { 'x-publishable-api-key': demoKey, 'x-bg-service-key': serviceKey },
  signal: AbortSignal.timeout(15_000),
})
assert.equal(detailResponse.status, 200, 'published demo product detail should be available')
assert.equal(detailResponse.headers.get('cache-control'), 'no-store')
const detail = (await detailResponse.json()).product
assert.equal(detail.handle, catalog.products[0].handle)
assert(detail.variants.length > 0)
assert(detail.variants.every((variant) =>
  variant.priceVnd === null || Number.isSafeInteger(variant.priceVnd)
))
assert(detail.variants.every((variant) => Number.isInteger(variant.maxOrderQuantity) &&
  (variant.available ? variant.maxOrderQuantity > 0 : variant.maxOrderQuantity === 0)
))
assert(!JSON.stringify(detail).includes('<script'))
const missingDetail = await fetch(detailBase + 'not-a-real-product', {
  headers: { 'x-publishable-api-key': demoKey, 'x-bg-service-key': serviceKey },
  signal: AbortSignal.timeout(15_000),
})
assert.equal(missingDetail.status, 404)
const wrongChannelDetail = await fetch(detailBase + encodeURIComponent(catalog.products[0].handle), {
  headers: { 'x-publishable-api-key': starterKey, 'x-bg-service-key': serviceKey },
  signal: AbortSignal.timeout(15_000),
})
assert.equal(wrongChannelDetail.status, 403)
console.log('PASS catalog HTTP: full-scope pages/filters and channel-scoped, no-store product detail with live variant prices/availability')
