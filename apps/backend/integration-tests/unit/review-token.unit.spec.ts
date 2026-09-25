import { createReviewToken, verifyReviewToken } from '../../src/checkout/review-token'

const claims = {
  sid: 'session_fixture', cid: 'cart_fixture', fingerprint: 'a'.repeat(64), total: 229000,
  currency: 'vnd' as const, shipping: 'so_fixture', payment: 'cod' as const,
  paymentSession: 'pay_session_fixture',
}

describe('checkout review token', () => {
  const original = process.env.REVIEW_TOKEN_SECRET
  beforeEach(() => { process.env.REVIEW_TOKEN_SECRET = 'unit-test-only-review-signing-secret-32bytes+' })
  afterAll(() => {
    if (original === undefined) delete process.env.REVIEW_TOKEN_SECRET
    else process.env.REVIEW_TOKEN_SECRET = original
  })

  it('signs a five-minute token without embedding customer PII and binds checkout claims', () => {
    const { token } = createReviewToken(claims, 1_000_000)
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('address')
    expect(payload.sid).not.toBe(claims.sid)
    expect(payload.cid).not.toBe(claims.cid)
    expect(payload.n).toHaveLength(22)
    expect(verifyReviewToken(token, claims, 1_000_001)).toBe(true)
    expect(verifyReviewToken(token, { ...claims, total: claims.total + 1 }, 1_000_001)).toBe(false)
    expect(verifyReviewToken(token, { ...claims, sid: 'another_session' }, 1_000_001)).toBe(false)
  })

  it('rejects tampering, malformed input, expiry and absent signing configuration', () => {
    const { token } = createReviewToken(claims, 1_000_000)
    expect(verifyReviewToken(`${token.slice(0, -1)}x`, claims, 1_000_001)).toBe(false)
    expect(verifyReviewToken('not-a-token', claims, 1_000_001)).toBe(false)
    expect(verifyReviewToken(token, claims, 1_300_000)).toBe(false)
    delete process.env.REVIEW_TOKEN_SECRET
    expect(verifyReviewToken(token, claims, 1_000_001)).toBe(false)
    expect(() => createReviewToken(claims, 1_000_000)).toThrow('REVIEW_TOKEN_SECRET_UNAVAILABLE')
  })
})
