import { model } from '@medusajs/framework/utils'

const NotificationDelivery = model.define('notification_delivery', {
  id: model.id().primaryKey(),
  order_id: model.text().index(),
  template_key: model.text(),
  template_version: model.text(),
  provider_message_id: model.text().nullable(),
  attempt_count: model.number().default(0),
  status: model.enum(['pending', 'sending', 'sent', 'retry', 'failed']).default('pending'),
  next_attempt_at: model.dateTime().index().nullable(),
}).indexes([{ on: ['order_id', 'template_key', 'template_version'], unique: true }])

export default NotificationDelivery
