import { model } from '@medusajs/framework/utils'

const CartCompletion = model.define('cart_completion', {
  id: model.id().primaryKey(),
  cart_id: model.text().unique(),
  session_id: model.text().index(),
  status: model.enum(['created', 'processing', 'succeeded', 'reconciling', 'failed']).default('created'),
  workflow_transaction_id: model.text().nullable(),
  order_id: model.text().index().nullable(),
  cart_fingerprint: model.text(),
  last_error_code: model.text().nullable(),
})

export default CartCompletion
