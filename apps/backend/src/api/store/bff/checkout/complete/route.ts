import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { cartContext } from '../../../../../cart/cart'
import { resolveSession } from '../../../../../identity/session'
import { COMMERCE_IDENTITY_MODULE } from '../../../../../modules/commerce-identity'
import type CommerceIdentityService from '../../../../../modules/commerce-identity/service'
import { completeCheckoutWorkflow } from '../../../../../workflows/complete-checkout'

const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_ERROR_CODES = new Set(['CART_CHANGED', 'CHECKOUT_INCOMPLETE', 'CART_NOT_READY',
  'IDEMPOTENCY_CONFLICT', 'REVIEW_INVALID', 'CHECKOUT_PENDING', 'CHECKOUT_ALREADY_COMPLETED'])

function safeWorkflowCode(error: unknown): string | null {
  const seen = new Set<unknown>()
  const visit = (value: unknown, depth: number): string | null => {
    if (depth > 4 || !value || seen.has(value)) return null
    if (typeof value === 'string') return SAFE_ERROR_CODES.has(value.trim()) ? value.trim() : null
    if (typeof value !== 'object') return null
    seen.add(value)
    const record = value as Record<string, unknown>
    for (const key of ['message', 'code', 'errors', 'error', 'cause']) {
      const result = visit(record[key], depth + 1)
      if (result) return result
    }
    return null
  }
  return visit(error, 0)
}

export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  const key = req.get('idempotency-key')
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).length !== 1 || typeof (body as { reviewToken?: unknown }).reviewToken !== 'string' ||
    (body as { reviewToken: string }).reviewToken.length > 2048 || !key || !IDEMPOTENCY_KEY.test(key)) {
    return res.status(400).json({ error: { code: 'INVALID_CHECKOUT_INTENT' } })
  }
  const session = await resolveSession(req)
  if (!session?.cart_id) return res.status(409).json({ error: { code: 'CART_UNAVAILABLE' } })
  const context = await cartContext(req)
  if (!context) return res.status(503).json({ error: { code: 'CART_CONTEXT_UNAVAILABLE' } })
  try {
    const { result } = await completeCheckoutWorkflow(req.scope).run({ input: {
      cart_id: session.cart_id, session_id: session.id, channel_id: context.channelId,
      idempotency_key: key, review_token: (body as { reviewToken: string }).reviewToken,
    } })
    return res.status(201).json({ data: {
      status: 'succeeded', orderReference: result.orderReference,
    } })
  } catch (error) {
    const code = safeWorkflowCode(error)
    if (code === 'CART_CHANGED' || code === 'CHECKOUT_INCOMPLETE' || code === 'CART_NOT_READY' ||
      code === 'IDEMPOTENCY_CONFLICT') return res.status(409).json({ error: { code } })
    if (code === 'REVIEW_INVALID') return res.status(422).json({ error: { code } })
    if (code === 'CHECKOUT_PENDING') return res.status(202).json({ data: {
      status: 'pending', intentId: key, pollAfterMs: 1000,
    } })
    if (code === 'CHECKOUT_ALREADY_COMPLETED' && session?.cart_id) {
      const identity = req.scope.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
      const [completion] = await identity.listCartCompletions({ cart_id: session.cart_id })
      if (completion?.order_id) {
        const query = req.scope.resolve<any>(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({ entity: 'order', fields: ['id', 'display_id'],
          filters: { id: completion.order_id } })
        if (data[0]?.display_id) return res.status(200).json({ data: {
          status: 'succeeded', orderReference: String(data[0].display_id),
        } })
      }
      return res.status(202).json({ data: { status: 'pending', intentId: key, pollAfterMs: 1000 } })
    }
    return res.status(503).json({ error: { code: 'CHECKOUT_COMPLETION_UNAVAILABLE' } })
  }
}
