import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { requireBffService } from './middlewares/require-bff-service'
import { requireCommerceSession } from './middlewares/require-commerce-session'

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
