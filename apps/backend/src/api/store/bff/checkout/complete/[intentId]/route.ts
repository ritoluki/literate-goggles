import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { resolveSession } from '../../../../../../identity/session'
import { COMMERCE_IDENTITY_MODULE } from '../../../../../../modules/commerce-identity'
import type CommerceIdentityService from '../../../../../../modules/commerce-identity/service'
import { reconcileCheckoutCompletion } from '../../../../../../checkout/reconcile-completion'

const INTENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const intentId = req.params.intentId
  if (!intentId || !INTENT_ID.test(intentId)) return res.status(404).json({ error: { code: 'INTENT_NOT_FOUND' } })

  const session = await resolveSession(req)
  if (!session) return res.status(404).json({ error: { code: 'INTENT_NOT_FOUND' } })
  const identity = req.scope.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const [intent] = await identity.listIdempotencyRequests({
    session_id: session.id, key: intentId, operation: 'checkout.complete',
  })
  if (!intent) return res.status(404).json({ error: { code: 'INTENT_NOT_FOUND' } })

  if (intent.status === 'succeeded' && intent.result_pointer) {
    const query = req.scope.resolve<any>(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: 'order', fields: ['id', 'display_id'],
      filters: { id: intent.result_pointer } })
    if (data[0]?.display_id) return res.status(200).json({ data: {
      status: 'succeeded', orderReference: String(data[0].display_id),
    } })
  }

  if (intent.status === 'processing') {
    const completions = await identity.listCartCompletions({ session_id: session.id })
    for (const completion of completions) {
      if (!['processing', 'reconciling'].includes(completion.status)) continue
      const recovered = await reconcileCheckoutCompletion(req.scope, completion, intent.id)
      if (recovered) return res.status(200).json({ data: {
        status: 'succeeded', orderReference: recovered.orderReference,
      } })
    }
  }

  if (intent.status === 'failed') return res.status(200).json({ data: { status: 'failed' } })
  return res.status(202).json({ data: { status: 'pending', intentId, pollAfterMs: 1000 } })
}
