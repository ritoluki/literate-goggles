import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { MedusaError } from '@medusajs/framework/utils'

const TOKEN_TTL_MS = 5 * 60 * 1000
const TOKEN_VERSION = 1

export type ReviewClaims = {
  v: 1
  n: string
  sid: string
  cid: string
  fingerprint: string
  total: number
  currency: 'vnd'
  shipping: string
  payment: 'cod'
  paymentSession: string
  iat: number
  exp: number
}

function secret() {
  const value = process.env.REVIEW_TOKEN_SECRET
  return value && value.length >= 32 ? value : null
}

export function reviewTokenConfigured() { return secret() !== null }

export function createReviewToken(input: Omit<ReviewClaims, 'v' | 'n' | 'iat' | 'exp'>, now = Date.now()) {
  const key = secret()
  if (!key) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'REVIEW_TOKEN_SECRET_UNAVAILABLE')
  const claims: ReviewClaims = { ...input,
    sid: createHash('sha256').update(`session:${input.sid}`).digest('hex'),
    cid: createHash('sha256').update(`cart:${input.cid}`).digest('hex'),
    v: TOKEN_VERSION, n: randomBytes(16).toString('base64url'), iat: now, exp: now + TOKEN_TTL_MS }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = createHmac('sha256', key).update(payload).digest('base64url')
  return { token: `${payload}.${signature}`, expiresAt: new Date(claims.exp).toISOString() }
}

export function verifyReviewToken(token: unknown, expected: Pick<ReviewClaims,
  'sid' | 'cid' | 'fingerprint' | 'total' | 'currency' | 'shipping' | 'payment' | 'paymentSession'>,
now = Date.now()): boolean {
  const key = secret()
  if (!key || typeof token !== 'string' || token.length > 2048) return false
  const parts = token.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return false
  const signature = createHmac('sha256', key).update(parts[0]).digest()
  const supplied = Buffer.from(parts[1], 'base64url')
  if (supplied.length !== signature.length || !timingSafeEqual(supplied, signature)) return false
  let claims: ReviewClaims
  try { claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as ReviewClaims }
  catch { return false }
  const expectedClaims = { ...expected,
    sid: createHash('sha256').update(`session:${expected.sid}`).digest('hex'),
    cid: createHash('sha256').update(`cart:${expected.cid}`).digest('hex'),
  }
  return claims.v === TOKEN_VERSION && /^[A-Za-z0-9_-]{22}$/.test(claims.n) &&
    Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp) &&
    claims.iat <= now && claims.exp > now && claims.exp - claims.iat === TOKEN_TTL_MS &&
    Object.entries(expectedClaims).every(([keyName, value]) => claims[keyName as keyof ReviewClaims] === value)
}
