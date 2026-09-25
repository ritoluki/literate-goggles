import { createStep, createWorkflow, StepResponse, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { COMMERCE_IDENTITY_MODULE } from '../modules/commerce-identity'
import type CommerceIdentityService from '../modules/commerce-identity/service'

type Input = { token_hash: string; expires_at: Date }

const createSessionStep = createStep(
  'create-session',
  async (input: Input, { container }) => {
    const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
    const session = await identity.createCommerceSessions(input)
    return new StepResponse({ id: session.id }, session.id)
  },
  async (id, { container }) => {
    if (!id) return
    const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
    await identity.deleteCommerceSessions(id)
  }
)

export const createCommerceSessionWorkflow = createWorkflow(
  'create-commerce-session',
  (input: Input) => new WorkflowResponse(createSessionStep(input))
)
