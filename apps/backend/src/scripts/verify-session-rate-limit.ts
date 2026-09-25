import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { allowSessionCreate } from '../identity/session-rate-limit'

export default async function verifySessionRateLimit() {
  const syntheticIp = 'test-' + randomBytes(12).toString('hex')
  for (let attempt = 1; attempt <= 10; attempt++) {
    assert(await allowSessionCreate(syntheticIp), 'Rate limiter denied before threshold')
  }
  assert(!await allowSessionCreate(syntheticIp), 'Rate limiter failed to deny attempt 11')
  console.log('PASS session rate limit: first 10 permitted; 11th denied in the same Redis window')
}
