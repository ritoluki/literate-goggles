import { MedusaError } from '@medusajs/framework/utils'
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { acquireLockStep, createCartWorkflow, releaseLockStep } from '@medusajs/medusa/core-flows'
import { COMMERCE_IDENTITY_MODULE } from '../modules/commerce-identity'
import type CommerceIdentityService from '../modules/commerce-identity/service'

type Input = { session_id: string; region_id: string; sales_channel_id: string }

const ensureUnboundStep = createStep(
  'ensure-unbound',
  async (input: { session_id: string }, { container }) => {
    const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
    const session = await identity.retrieveCommerceSession(input.session_id)
    if (session.cart_id) {
      throw new MedusaError(MedusaError.Types.CONFLICT, 'SESSION_CART_EXISTS')
    }
    return new StepResponse(true)
  }
)

const bindSessionCartStep = createStep(
  'bind-session-cart',
  async (input: { session_id: string; cart_id: string }, { container }) => {
    const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
    await identity.updateCommerceSessions({ id: input.session_id, cart_id: input.cart_id })
    return new StepResponse(input.cart_id, input.session_id)
  },
  async (sessionId, { container }) => {
    if (!sessionId) return
    const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
    await identity.updateCommerceSessions({ id: sessionId, cart_id: null })
  }
)

export const createSessionCartWorkflow = createWorkflow(
  'create-session-cart',
  (input: Input) => {
    const lockKey = transform(input, (data) => 'session-cart:' + data.session_id)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 30 })
    ensureUnboundStep({ session_id: input.session_id })
    const cart = createCartWorkflow.runAsStep({
      input: { region_id: input.region_id, sales_channel_id: input.sales_channel_id },
    })
    const cartId = bindSessionCartStep({ session_id: input.session_id, cart_id: cart.id })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(cartId)
  }
)
