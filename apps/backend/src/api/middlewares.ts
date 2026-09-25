import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { requireBffService } from './middlewares/require-bff-service'
import { requireCommerceSession } from './middlewares/require-commerce-session'
import { limitCartWrites } from './middlewares/limit-cart-writes'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      matcher: /^\/store(?:\/.*)?$/i,
      middlewares: [requireBffService],
    },
    {
      matcher: /^\/store\/bff\/(?!session(?:\/|$)).+$/,
      middlewares: [requireCommerceSession],
    },
    {
      matcher: /^\/store\/bff\/cart(?:\/.*)?$/i,
      method: ['POST', 'PUT', 'PATCH', 'DELETE'],
      middlewares: [limitCartWrites],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
