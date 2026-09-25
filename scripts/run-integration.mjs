import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const healthUrl = 'http://127.0.0.1:9000/health'
const catalogBffUrl = 'http://127.0.0.1:3000/api/v1/catalog?limit=1'
const deadlineMs = 150_000
const serviceKey = process.env.BFF_SERVICE_KEY ?? randomBytes(32).toString('hex')
const csrfSecret = process.env.CSRF_SECRET ?? randomBytes(32).toString('hex')
const authEnv = { ...process.env, BFF_SERVICE_KEY: serviceKey, CSRF_SECRET: csrfSecret }

async function isHealthy() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) })
    return response.status === 200 && (await response.text()).trim() === 'OK'
  } catch {
    return false
  }
}

async function waitForBackend(child) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < deadlineMs) {
    if (child.exitCode !== null) {
      throw new Error(`Medusa exited before becoming healthy (exit ${child.exitCode})`)
    }
    if (await isHealthy()) return
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`Medusa did not become healthy within ${deadlineMs / 1_000}s`)
}

async function isStorefrontHealthy() {
  try {
    const response = await fetch(catalogBffUrl, { signal: AbortSignal.timeout(5_000) })
    return response.status === 200
  } catch {
    return false
  }
}

async function waitForStorefront(child) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < deadlineMs) {
    if (child.exitCode !== null) throw new Error('Storefront exited before catalog became healthy')
    if (await isStorefrontHealthy()) return
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error('Storefront catalog did not become healthy in time')
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
  } else {
    try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
  }
}

let backend
let storefront
try {
  if (await isHealthy() && !process.env.BFF_SERVICE_KEY) {
    throw new Error('Stop existing Medusa or supply its BFF_SERVICE_KEY for integration tests')
  }
  const dbCheck = spawnSync('docker', [
    'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'bangon', '-d', 'bangon',
  ], {
    cwd: process.cwd(),
    input: readFileSync('apps/backend/integration-tests/db/commerce-identity.sql'),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  if (dbCheck.error) throw dbCheck.error
  if (dbCheck.status !== 0) throw new Error('Commerce identity database checks failed')

  if (!(await isHealthy())) {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm'
    const args = process.platform === 'win32'
      ? ['/d', '/c', 'pnpm.cmd', '--dir', 'apps/backend', 'run', 'dev']
      : ['--dir', 'apps/backend', 'run', 'dev']
    backend = spawn(command, args, {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: authEnv,
    })
    await waitForBackend(backend)
  }

  const result = spawnSync(process.execPath, ['scripts/check-service-dependencies.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Service dependency checks failed')
  const catalog = spawnSync(process.execPath, ['scripts/check-catalog-http.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: authEnv,
  })
  if (catalog.error) throw catalog.error
  if (catalog.status !== 0) throw new Error('Medusa catalog checks failed')

  if (!(await isStorefrontHealthy())) {
    const keyResult = spawnSync('docker', [
      'compose', '-f', 'infra/compose.dev.yml', 'exec', '-T', 'postgres',
      'psql', '-t', '-A', '-U', 'bangon', '-d', 'bangon', '-c',
      "select token from api_key where title like '%Demo Storefront Key' and type='publishable' and deleted_at is null and revoked_at is null limit 1",
    ], { cwd: process.cwd(), encoding: 'utf8' })
    const key = keyResult.stdout?.trim()
    if (keyResult.error || keyResult.status !== 0 || !key?.startsWith('pk_')) {
      throw new Error('Could not resolve local demo catalog key')
    }
    const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm'
    const args = process.platform === 'win32'
      ? ['/d', '/c', 'pnpm.cmd', '--dir', 'apps/storefront', 'run', 'dev']
      : ['--dir', 'apps/storefront', 'run', 'dev']
    storefront = spawn(command, args, {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      stdio: 'inherit',
      env: {
        ...process.env,
        BFF_SERVICE_KEY: serviceKey,
        CSRF_SECRET: csrfSecret,
        MEDUSA_PUBLISHABLE_KEY: key,
        BACKEND_URL: 'http://127.0.0.1:9000',
      },
    })
    await waitForStorefront(storefront)
  }
  const bff = spawnSync(process.execPath, ['scripts/check-bff-catalog.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (bff.error) throw bff.error
  if (bff.status !== 0) throw new Error('BFF catalog checks failed')
  const session = spawnSync(process.execPath, ['scripts/check-session-http.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: authEnv,
  })
  if (session.error) throw session.error
  process.exitCode = session.status ?? 1
} catch (error) {
  console.error(`FAIL integration runner: ${error.message}`)
  process.exitCode = 1
} finally {
  stopProcessTree(storefront)
  stopProcessTree(backend)
}
