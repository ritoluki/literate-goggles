import { model } from '@medusajs/framework/utils'

// Core cart IDs are references only; checkout writes remain in Medusa workflows.
const CommerceSession = model.define('commerce_session', {
  id: model.id().primaryKey(),
  token_hash: model.text().unique(),
  cart_id: model.text().unique().nullable(),
  expires_at: model.dateTime().index(),
})

export default CommerceSession
