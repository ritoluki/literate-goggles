import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import { MedusaError } from '@medusajs/framework/utils'

const WINDOW_SECONDS = 60
const MAX_CREATES = 10
const MAX_CART_WRITES = 20
const SCRIPT = [
  'local n = redis.call("INCR", KEYS[1])',
  'if n == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end',
  'return n',
].join('\n')

let redis: Redis | undefined

async function allowFixedWindow(namespace: string, identity: string, max: number): Promise<boolean> {
  if (!identity || !process.env.REDIS_URL) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'Session rate limit unavailable')
  }
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      enableOfflineQueue: false,
    })
    redis.on('error', () => {})
  }
  if (redis.status === 'wait') await redis.connect()
  const identityHash = createHash('sha256').update(identity).digest('hex')
  const window = Math.floor(Date.now() / (WINDOW_SECONDS * 1000))
  const count = await redis.eval(SCRIPT, 1, 'bg:' + namespace + ':' + identityHash + ':' + window,
    WINDOW_SECONDS + 2)
  return typeof count === 'number' && count <= max
}

export function allowSessionCreate(clientIp: string | undefined): Promise<boolean> {
  return allowFixedWindow('session:create', clientIp ?? '', MAX_CREATES)
}

export function allowCartWrite(sessionHash: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(sessionHash)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Invalid session hash')
  }
  return allowFixedWindow('cart:write', sessionHash, MAX_CART_WRITES)
}
