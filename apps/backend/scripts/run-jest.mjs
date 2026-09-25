import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const testType = process.argv[2]
if (!['unit', 'integration:http', 'integration:modules'].includes(testType)) {
  console.error('Expected test type: unit, integration:http, or integration:modules')
  process.exit(2)
}

const result = spawnSync(process.execPath, [
  '--experimental-vm-modules',
  require.resolve('jest/bin/jest'),
  testType === 'unit' ? '--silent' : '--silent=false',
  '--runInBand',
  '--forceExit',
], {
  cwd: process.cwd(),
  env: { ...process.env, TEST_TYPE: testType },
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
