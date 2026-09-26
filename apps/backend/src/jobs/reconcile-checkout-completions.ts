import type { MedusaContainer } from '@medusajs/framework/types'
import { COMMERCE_IDENTITY_MODULE } from '../modules/commerce-identity'
import type CommerceIdentityService from '../modules/commerce-identity/service'
import { reconcileCheckoutCompletion } from '../checkout/reconcile-completion'

export default async function reconcileCheckoutCompletions(container: MedusaContainer) {
  const identity = container.resolve<CommerceIdentityService>(COMMERCE_IDENTITY_MODULE)
  const completions = await identity.listCartCompletions({ status: ['processing', 'reconciling'] })
  const staleBefore = Date.now() - 60_000

  for (const completion of completions) {
    if (new Date(completion.updated_at).getTime() > staleBefore) continue
    try {
      await reconcileCheckoutCompletion(container, completion)
    } catch {
      // Keep uncertain attempts pending; a later job or owner poll retries safely.
    }
  }
}

export const config = {
  name: 'reconcile-checkout-completions',
  schedule: '* * * * *',
}
