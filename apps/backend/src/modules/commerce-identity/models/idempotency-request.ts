import { model } from '@medusajs/framework/utils'

const IdempotencyRequest = model.define('idempotency_request', {
  id: model.id().primaryKey(),
  session_id: model.text().index(),
  key: model.text(),
  operation: model.text(),
  request_hash: model.text(),
  result_pointer: model.text().nullable(),
  status: model.enum(['created', 'processing', 'succeeded', 'failed']).default('created'),
  expires_at: model.dateTime().index(),
}).indexes([{ on: ['session_id', 'key', 'operation'], unique: true }])

export default IdempotencyRequest
