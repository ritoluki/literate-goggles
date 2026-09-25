import { createHash } from 'node:crypto'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { acquireLockStep, completeCartWorkflow, releaseLockStep } from '@medusajs/medusa/core-flows'
import { cartSnapshot } from '../cart/cart'
import { inspectReviewToken } from '../checkout/review-token'
import { COMMERCE_IDENTITY_MODULE } from '../modules/commerce-identity'
import type CommerceIdentityService from '../modules/commerce-identity/service'

type Input = { cart_id: string; session_id: string; channel_id: string; idempotency_key: string; review_token: string }
type Prepared = { requestId: string; completionId: string }

const prepareCheckoutStep = createStep('prepare-checkout', async (input: Input, { container }) => {
  const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)
  const operation = 'checkout.complete'
  const requestHash = createHash('sha256').update(input.review_token).digest('hex')
  const [requests, completions] = await Promise.all([
    identity.listIdempotencyRequests({ session_id: input.session_id, key: input.idempotency_key, operation }),
    identity.listCartCompletions({ cart_id: input.cart_id }),
  ])
  const request = requests[0]
  const completion = completions[0]
  if (request && request.request_hash !== requestHash) {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'IDEMPOTENCY_CONFLICT')
  }
  if (request?.status === 'succeeded' || completion?.status === 'succeeded') {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'CHECKOUT_ALREADY_COMPLETED')
  }
  if (completion && ['processing', 'reconciling'].includes(completion.status)) {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'CHECKOUT_PENDING')
  }

  const { data: carts } = await query.graph({ entity: 'cart', filters: { id: input.cart_id }, fields: [
    'id', 'email', 'shipping_address.*', 'shipping_methods.id', 'payment_collection.payment_sessions.id',
    'payment_collection.payment_sessions.provider_id', 'payment_collection.payment_sessions.status',
    'completed_at',
  ] })
  const cart = carts[0]
  const shippingId = cart?.shipping_methods?.[0]?.id
  const paymentSession = (cart?.payment_collection?.payment_sessions ?? []).find((item: any) =>
    item.provider_id === 'pp_system_default' && item.status !== 'canceled')
  if (!cart || cart.completed_at || !cart.email || !cart.shipping_address || !shippingId || !paymentSession?.id) {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'CHECKOUT_INCOMPLETE')
  }
  const snapshot = await cartSnapshot(query, input.cart_id, input.channel_id)
  if (snapshot.shippingVnd === null || !snapshot.items.length || snapshot.items.some((item) => !item.available)) {
    throw new MedusaError(MedusaError.Types.CONFLICT, 'CART_NOT_READY')
  }
  const tokenStatus = inspectReviewToken(input.review_token, {
    sid: input.session_id, cid: input.cart_id, fingerprint: snapshot.revision, total: snapshot.totalVnd,
    currency: 'vnd', shipping: shippingId, payment: 'cod', paymentSession: paymentSession.id,
  })
  if (tokenStatus === 'changed') throw new MedusaError(MedusaError.Types.CONFLICT, 'CART_CHANGED')
  if (tokenStatus !== 'valid') throw new MedusaError(MedusaError.Types.INVALID_DATA, 'REVIEW_INVALID')

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const requestRecord = request ?? await identity.createIdempotencyRequests({ session_id: input.session_id,
    key: input.idempotency_key, operation, request_hash: requestHash, result_pointer: null,
    status: 'processing', expires_at: expiresAt })
  const completionRecord = completion ?? await identity.createCartCompletions({ cart_id: input.cart_id,
    session_id: input.session_id, status: 'processing', workflow_transaction_id: null,
    order_id: null, cart_fingerprint: snapshot.revision })
  return new StepResponse<Prepared>({ requestId: requestRecord.id, completionId: completionRecord.id }, {
    requestId: requestRecord.id, completionId: completionRecord.id,
  })
}, async (prepared, { container }) => {
  if (!prepared) return
  const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  await identity.updateCartCompletions({ id: prepared.completionId, status: 'reconciling',
    last_error_code: 'COMPLETION_RESULT_UNKNOWN' })
  await identity.updateIdempotencyRequests({ id: prepared.requestId, status: 'processing' })
})

const persistOrderStep = createStep('persist-order', async (input: {
  prepared: Prepared | undefined; orderId: string
}, { container }) => {
  if (!input.prepared) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'COMPLETION_LEDGER_UNAVAILABLE')
  const prepared = input.prepared
  const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: 'order', fields: ['id', 'display_id'],
    filters: { id: input.orderId } })
  const order = data[0]
  if (!order?.display_id) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'ORDER_REFERENCE_UNAVAILABLE')
  await identity.updateCartCompletions({ id: prepared.completionId,
    status: 'succeeded', order_id: order.id, last_error_code: null })
  await identity.updateIdempotencyRequests({ id: prepared.requestId,
    status: 'succeeded', result_pointer: order.id })
  return new StepResponse({ status: 'succeeded' as const, orderReference: String(order.display_id) })
})

export const completeCheckoutWorkflow = createWorkflow('complete-checkout', (input: Input) => {
  acquireLockStep({ key: input.cart_id, timeout: 5, ttl: 120 })
  const prepared = prepareCheckoutStep(input)
  const order = completeCartWorkflow.runAsStep({ input: { id: input.cart_id } })
  const result = persistOrderStep(transform({ prepared, order }, (data) => ({
    prepared: data.prepared, orderId: data.order.id,
  })))
  releaseLockStep({ key: input.cart_id })
  return new WorkflowResponse(result)
})
