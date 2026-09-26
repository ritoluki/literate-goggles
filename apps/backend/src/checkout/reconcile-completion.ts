import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { COMMERCE_IDENTITY_MODULE } from '../modules/commerce-identity'
import type CommerceIdentityService from '../modules/commerce-identity/service'

type Completion = {
  id: string
  cart_id: string
  session_id: string
  status: string
  workflow_transaction_id: string | null
  order_id?: string | null
  updated_at?: Date | string
}

type WorkflowExecution = {
  workflow_id: string
  transaction_id: string
  execution: { steps?: Record<string, { invoke?: { state?: string; status?: string } }> } | null
  context: { data?: { invoke?: Record<string, { output?: { output?: Record<string, unknown> } }> } } | null
}

/**
 * Recover the durable ledger only from Medusa's retained output of its real core
 * complete-cart step, linked to this ledger by its prepare-step output. Never
 * infer or create an order when that evidence is absent.
 */
export async function reconcileCheckoutCompletion(container: MedusaContainer, completion: Completion,
  expectedRequestId?: string) {
  if (!completion.workflow_transaction_id || !['processing', 'reconciling'].includes(completion.status)) {
    return null
  }

  const workflowEngine = container.resolve<any>(Modules.WORKFLOW_ENGINE)
  const executions = await workflowEngine.listWorkflowExecutions({
    workflow_id: 'complete-checkout', transaction_id: completion.workflow_transaction_id,
  }) as WorkflowExecution[]
  const execution = executions[0]
  const steps = execution?.execution?.steps ?? {}
  const completeCart = Object.values(steps).find((step) =>
    step?.invoke?.state === 'done' && step.invoke.status === 'ok' &&
    Object.keys(steps).some((id) => id.endsWith('.complete-cart-as-step') && steps[id] === step))
  if (!execution || execution.transaction_id !== completion.workflow_transaction_id || !completeCart) return null

  const invocationData = execution.context?.data?.invoke ?? {}
  const orderId = invocationData['complete-cart-as-step']?.output?.output?.id
  const requestId = invocationData['prepare-checkout']?.output?.output?.requestId
  const completionId = invocationData['prepare-checkout']?.output?.output?.completionId
  if (typeof orderId !== 'string' || typeof requestId !== 'string' || completionId !== completion.id ||
    (expectedRequestId && expectedRequestId !== requestId)) {
    return null
  }

  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({ entity: 'order', fields: ['id', 'display_id', 'canceled_at'],
    filters: { id: orderId } })
  const order = orders[0]
  if (!order?.display_id || order.canceled_at) return null

  const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const [request] = await identity.listIdempotencyRequests({ id: requestId, session_id: completion.session_id,
    operation: 'checkout.complete' })
  if (!request) return null

  await identity.updateCartCompletions({ id: completion.id, status: 'succeeded', order_id: order.id,
    last_error_code: null })
  await identity.updateIdempotencyRequests({ id: request.id, status: 'succeeded', result_pointer: order.id })
  return { orderId: order.id, orderReference: String(order.display_id) }
}
