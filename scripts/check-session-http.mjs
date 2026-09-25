import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const origin = 'http://127.0.0.1:3000'
const bff = new URL('/api/v1/session', origin)
const backend = 'http://127.0.0.1:9000'
const serviceKey = process.env.BFF_SERVICE_KEY
if (!serviceKey) throw new Error('BFF_SERVICE_KEY missing')

const query = spawnSync('docker', [
  'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
  'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c',
  "select token from api_key where title like '%Demo Storefront Key' and type='publishable' and deleted_at is null limit 1",
], { cwd: process.cwd(), encoding: 'utf8' })
if (query.error || query.status !== 0) throw new Error('Demo key query failed')
const key = query.stdout.trim()
const post = (headers, body = '{}') => fetch(bff, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers },
  body, signal: AbortSignal.timeout(20_000),
})

assert.equal((await post({})).status, 403, 'missing Origin must fail')
assert.equal((await post({ origin: 'https://evil.invalid' })).status, 403, 'cross origin must fail')
assert.equal((await post({ origin }, '{"extra":1}')).status, 400, 'session body must be empty object')
const created = await post({ origin })
assert.equal(created.status, 201)
assert.equal(created.headers.get('cache-control'), 'private, no-store')
const cookieHeader = created.headers.get('set-cookie') ?? ''
assert.match(cookieHeader, /^bg_session=[A-Za-z0-9_-]{43};/)
assert.match(cookieHeader, /httponly/i)
assert.match(cookieHeader, /samesite=lax/i)
const token = cookieHeader.match(/^bg_session=([A-Za-z0-9_-]{43});/)?.[1]
assert(token)
const createdBody = await created.json()
assert.match(createdBody.data.csrfToken, /^[A-Za-z0-9_-]{43}$/)
assert(!JSON.stringify(createdBody).includes(token), 'raw token must not appear in JSON')

const read = await fetch(bff, {
  headers: { cookie: 'bg_session=' + token }, signal: AbortSignal.timeout(20_000),
})
assert.equal(read.status, 200)
assert.equal((await read.json()).data.csrfToken, createdBody.data.csrfToken)
assert.equal((await fetch(bff)).status, 404)

const hash = createHash('sha256').update(token).digest('hex')
const db = spawnSync('docker', [
  'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
  'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c',
  "select count(*) from commerce_session where token_hash='" + hash + "' and expires_at > now()",
], { cwd: process.cwd(), encoding: 'utf8' })
assert.equal(db.status, 0)
assert.equal(db.stdout.trim(), '1', 'only hash should be stored')

for (const path of ['/store/catalog-v1', '/store/products', '/store/carts',
  '/store/carts/not-owned', '/store/orders/not-owned', '/store/bff/session']) {
  const response = await fetch(new URL(path, backend), {
    headers: { 'x-publishable-api-key': key },
    signal: AbortSignal.timeout(20_000),
  })
  assert.equal(response.status, 403, 'raw Store bypass: ' + path)
}
const rawWrite = await fetch(new URL('/store/carts', backend), {
  method: 'POST',
  headers: { 'x-publishable-api-key': key, 'content-type': 'application/json' },
  body: '{}', signal: AbortSignal.timeout(20_000),
})
assert.equal(rawWrite.status, 403, 'raw Store cart write bypass')
for (const path of ['/Store/products', '/store/products/', '/store//products']) {
  const response = await fetch(new URL(path, backend), {
    headers: { 'x-publishable-api-key': key },
    signal: AbortSignal.timeout(20_000),
  })
  assert(response.status === 403 || response.status === 404,
    'alternate Store route must not bypass guard: ' + path)
}
const invalidSession = await fetch(new URL('/store/bff/session', backend), {
  headers: {
    'x-publishable-api-key': key, 'x-bg-service-key': serviceKey,
    'x-bg-session-token': 'A'.repeat(43),
  }, signal: AbortSignal.timeout(20_000),
})
assert.equal(invalidSession.status, 404)
console.log('PASS session HTTP: Origin/body, HttpOnly cookie, hash-only DB, retrieval and six raw Store bypass paths')
