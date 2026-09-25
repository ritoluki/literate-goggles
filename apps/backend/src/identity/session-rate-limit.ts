import { createHash } from 'node:crypto'
import Redis from 'ioredis'
import { MedusaError } from '@medusajs/framework/utils'

const WINDOW_SECONDS = 60
const MAX_CREATES = 10
const SCRIPT = [
  'local n = redis.call("INCR", KEYS[1])',
  'if n == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end',
  'return n',
].join('\n')

let redis: Redis | undefined

export async function allowSessionCreate(clientIp: string | undefined): Promise<boolean> {
  if (!clientIp || !process.env.REDIS_URL) {
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
  const ipHash = createHash('sha256').update(clientIp).digest('hex')
  const window = Math.floor(Date.now() / (WINDOW_SECONDS * 1000))
  const count = await redis.eval(SCRIPT, 1, 'bg:session:create:' + ipHash + ':' + window,
    WINDOW_SECONDS + 2)
  return typeof count === 'number' && count <= MAX_CREATES
}
