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
const get = (path, key) => fetch(base + path, {
  headers: key ? { 'x-publishable-api-key': key } : {},
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
console.log('PASS catalog HTTP: 20 eligible products; full-set pages; invalid sort and wrong-channel key denied')
