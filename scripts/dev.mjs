import { spawnSync } from 'node:child_process'

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
const result = spawnSync('pnpm', args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MEDUSA_PUBLISHABLE_KEY: publishableKey,
    BACKEND_URL: process.env.BACKEND_URL ?? 'http://127.0.0.1:9000',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
