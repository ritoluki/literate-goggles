import { model } from '@medusajs/framework/utils'

const AdvisorPreference = model.define('advisor_preference', {
  id: model.id().primaryKey(),
  session_id: model.text().unique(),
  criteria: model.json(),
  version: model.number().default(1),
  expires_at: model.dateTime().index(),
})

export default AdvisorPreference
