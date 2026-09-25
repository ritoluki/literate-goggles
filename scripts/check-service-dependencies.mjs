import assert from 'node:assert/strict'
import { connect } from 'node:net'

const timeoutMs = 5_000

function tcpCheck(name, port, payload, expected) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port })
    const timer = setTimeout(() => socket.destroy(new Error(`${name} timed out`)), timeoutMs)
    let response = ''

    socket.setEncoding('utf8')
    socket.on('connect', () => {
      if (!payload) {
        clearTimeout(timer)
        socket.end()
        resolve(`${name}: TCP ${port} reachable`)
        return
      }
      socket.write(payload)
    })
    socket.on('data', (chunk) => {
      response += chunk
      if (response.includes(expected)) {
        clearTimeout(timer)
        socket.end()
        resolve(`${name}: responded with ${expected.trim()}`)
      }
    })
    socket.on('error', reject)
  })
}

async function httpCheck(name, url, expectedBody) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  const body = await response.text()
  assert.equal(response.status, 200, `${name} returned HTTP ${response.status}: ${body}`)
  if (expectedBody) assert.equal(body.trim(), expectedBody)
  return `${name}: HTTP 200`
}

const checks = [
  tcpCheck('PostgreSQL', 5433),
  tcpCheck('Redis', 6380, '*1\r\n$4\r\nPING\r\n', '+PONG'),
  httpCheck('Mailpit', 'http://127.0.0.1:8025/api/v1/info'),
  httpCheck('Medusa', 'http://127.0.0.1:9000/health', 'OK'),
]

if (process.argv.includes('--e2e')) {
  checks.push(httpCheck('Storefront', 'http://127.0.0.1:3000/'))
}

try {
  const results = await Promise.all(checks)
  for (const result of results) console.log(`PASS ${result}`)
} catch (error) {
  console.error(`FAIL integration dependency check: ${error.message}`)
  process.exitCode = 1
}
