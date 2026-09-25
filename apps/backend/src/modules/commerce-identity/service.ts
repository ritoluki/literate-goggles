import { MedusaService } from '@medusajs/framework/utils'
import AdvisorPreference from './models/advisor-preference'
import CartCompletion from './models/cart-completion'
import CommerceSession from './models/commerce-session'
import IdempotencyRequest from './models/idempotency-request'
import NotificationDelivery from './models/notification-delivery'
import OperationalSetting from './models/operational-setting'
import OrderAccessGrant from './models/order-access-grant'

class CommerceIdentityService extends MedusaService({
  CommerceSession,
  OrderAccessGrant,
  CartCompletion,
  IdempotencyRequest,
  AdvisorPreference,
  NotificationDelivery,
  OperationalSetting,
}) {}

export default CommerceIdentityService
