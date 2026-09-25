import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const healthUrl = 'http://127.0.0.1:9000/health'
const deadlineMs = 150_000

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

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
  } else {
    try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
  }
}

let backend
try {
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
    })
    await waitForBackend(backend)
  }

  const result = spawnSync(process.execPath, ['scripts/check-service-dependencies.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(`FAIL integration runner: ${error.message}`)
  process.exitCode = 1
} finally {
  stopProcessTree(backend)
}
