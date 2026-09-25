import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

let publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY
if (!publishableKey) {
  if (process.env.APP_MODE && process.env.APP_MODE !== 'demo') {
    throw new Error('MEDUSA_PUBLISHABLE_KEY must be configured outside local demo mode')
  }
  const result = spawnSync('docker', [
    'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
    'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c',
    "select token from api_key where title like '%Demo Storefront Key' and type='publishable' and deleted_at is null and revoked_at is null limit 1",
  ], { cwd: process.cwd(), encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new Error('Local PostgreSQL is unavailable; run pnpm infra:up first')
  }
  publishableKey = result.stdout.trim()
}
if (!publishableKey.startsWith('pk_')) {
  throw new Error('Demo publishable key is missing; run pnpm db:seed:demo first')
}

const args = ['--parallel', '--filter', '@ban-gon/backend', '--filter', '@ban-gon/storefront', 'run', 'dev']
const serviceKey = process.env.BFF_SERVICE_KEY ??
  (process.env.APP_MODE === 'demo' || !process.env.APP_MODE ? randomBytes(32).toString('hex') : undefined)
const csrfSecret = process.env.CSRF_SECRET ??
  (process.env.APP_MODE === 'demo' || !process.env.APP_MODE ? randomBytes(32).toString('hex') : undefined)
const reviewTokenSecret = process.env.REVIEW_TOKEN_SECRET ??
  (process.env.APP_MODE === 'demo' || !process.env.APP_MODE ? randomBytes(32).toString('hex') : undefined)
if (!serviceKey || serviceKey.length < 32) {
  throw new Error('BFF_SERVICE_KEY must contain at least 32 characters')
}
if (!csrfSecret || csrfSecret.length < 32) {
  throw new Error('CSRF_SECRET must contain at least 32 characters')
}
if (!reviewTokenSecret || reviewTokenSecret.length < 32) {
  throw new Error('REVIEW_TOKEN_SECRET must contain at least 32 characters')
}
const result = spawnSync('pnpm', args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MEDUSA_PUBLISHABLE_KEY: publishableKey,
    BFF_SERVICE_KEY: serviceKey,
    CSRF_SECRET: csrfSecret,
    REVIEW_TOKEN_SECRET: reviewTokenSecret,
    BACKEND_URL: process.env.BACKEND_URL ?? 'http://127.0.0.1:9000',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
