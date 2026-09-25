import { execFileSync } from 'node:child_process'

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm doctor\nChecks Node, pnpm, Docker Engine, and Docker Compose without printing environment secrets.')
  process.exit(0)
}

const failures = []

function run(label, command, args) {
  try {
    const output = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000,
    }).trim()
    console.log(`PASS ${label}: ${output.split(/\r?\n/)[0]}`)
    return output
  } catch (error) {
    failures.push(label)
    const detail = error.code === 'ENOENT' ? 'command not found' : `exit ${error.status ?? 'unknown'}`
    console.error(`FAIL ${label}: ${detail}`)
    return ''
  }
}

const nodeVersion = process.versions.node
const [major, minor] = nodeVersion.split('.').map(Number)
if (major > 22 || (major === 22 && minor >= 13)) {
  console.log(`PASS node: ${nodeVersion}`)
} else {
  failures.push('node')
  console.error(`FAIL node: ${nodeVersion}; expected >=22.13.0`)
}

if (process.platform === 'win32') {
  run('pnpm', 'cmd.exe', ['/d', '/c', 'pnpm.cmd', '--version'])
} else {
  run('pnpm', 'pnpm', ['--version'])
}
run('docker engine', 'docker', ['version', '--format', '{{.Server.Version}}'])
run('docker compose', 'docker', ['compose', 'version', '--short'])

if (failures.length) {
  console.error(`doctor: FAIL (${failures.join(', ')})`)
  process.exitCode = 1
} else {
  console.log('doctor: PASS')
}
