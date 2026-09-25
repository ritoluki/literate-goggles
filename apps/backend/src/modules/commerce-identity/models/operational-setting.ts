import { model } from '@medusajs/framework/utils'

const OperationalSetting = model.define('operational_setting', {
  id: model.id().primaryKey(),
  key: model.text().unique(),
  value: model.json(),
  version: model.number().default(1),
  changed_by: model.text(),
  changed_at: model.dateTime(),
  reason: model.text(),
})

export default OperationalSetting
