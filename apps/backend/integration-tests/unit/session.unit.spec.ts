import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ownsCart, resolveSession, tokenHash } from '../../src/identity/session'
import { requireCommerceSession } from '../../src/api/middlewares/require-commerce-session'

const token = 'A'.repeat(43)
const hash = tokenHash(token)

function request(cartId: string | null, expiresAt: Date, header = token) {
  const listCommerceSessions = jest.fn(async () => [{
    id: 'session_test', token_hash: hash, cart_id: cartId, expires_at: expiresAt,
  }])
  const req = {
    get: (name: string) => name === 'x-bg-session-token' ? header : undefined,
    scope: { resolve: () => ({ listCommerceSessions }) },
  } as unknown as MedusaRequest
  return { req, listCommerceSessions }
}

describe('commerce session ownership', () => {
  it('rejects malformed token before database access', async () => {
    const { req, listCommerceSessions } = request('cart_a', new Date(Date.now() + 60_000), 'bad')
    expect(await resolveSession(req)).toBeNull()
    expect(listCommerceSessions).not.toHaveBeenCalled()
  })

  it('looks up only the hash and denies expired sessions', async () => {
    const { req, listCommerceSessions } = request('cart_a', new Date(Date.now() - 1))
    expect(await resolveSession(req)).toBeNull()
    expect(listCommerceSessions).toHaveBeenCalledWith({ token_hash: hash })
  })

  it('allows only the cart bound to the active session', async () => {
    const { req } = request('cart_a', new Date(Date.now() + 60_000))
    expect(await ownsCart(req, 'cart_a')).toBe(true)
    expect(await ownsCart(req, 'cart_b')).toBe(false)
  })

  it('denies an unbound session', async () => {
    const { req } = request(null, new Date(Date.now() + 60_000))
    expect(await ownsCart(req, 'cart_a')).toBe(false)
  })

  it('requires an active session before a private BFF route', async () => {
    const { req } = request('cart_a', new Date(Date.now() + 60_000), '')
    const json = jest.fn()
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnValue({ json }),
    } as unknown as MedusaResponse
    const next = jest.fn()
    await requireCommerceSession(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
