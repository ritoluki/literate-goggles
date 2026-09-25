import { model } from '@medusajs/framework/utils'

const OrderAccessGrant = model.define('order_access_grant', {
  id: model.id().primaryKey(),
  session_id: model.text().index(),
  order_id: model.text().index(),
  public_reference: model.text(),
  expires_at: model.dateTime().index(),
}).indexes([{ on: ['session_id', 'order_id'], unique: true }])

export default OrderAccessGrant
