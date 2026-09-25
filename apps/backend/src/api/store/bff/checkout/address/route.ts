import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import {
  ownedCheckoutCart, parseGuestAddress, parseGuestEmail, quoteCartShipping,
  saveGuestAddress, cartSnapshot,
} from '../../../../../checkout/checkout'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const target = await ownedCheckoutCart(req)
  if (!target) return res.status(409).json({ error: { code: 'CART_UNAVAILABLE' } })
  const address = target.cart.shipping_address as Record<string, unknown> | null | undefined
  if (!address || !target.cart.email) return res.status(404).json({ error: { code: 'ADDRESS_NOT_FOUND' } })
  return res.json({ email: target.cart.email, address: {
    firstName: typeof address.first_name === 'string' ? address.first_name : '',
    lastName: typeof address.last_name === 'string' ? address.last_name : '',
    phone: typeof address.phone === 'string' ? address.phone : '',
    countryCode: address.country_code === 'vn' ? 'vn' : '',
    province: typeof address.province === 'string' ? address.province : '',
    city: typeof address.city === 'string' ? address.city : '',
    address1: typeof address.address_1 === 'string' ? address.address_1 : '',
    address2: typeof address.address_2 === 'string' ? address.address_2 : '',
    postalCode: typeof address.postal_code === 'string' ? address.postal_code : '',
  } })
}

export async function PUT(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).sort().join(',') !== 'address,email') {
    return res.status(400).json({ error: { code: 'INVALID_CHECKOUT_ADDRESS' } })
  }
  const input = body as Record<string, unknown>
  const email = parseGuestEmail(input.email)
  const address = parseGuestAddress(input.address)
  if (!email || !address) return res.status(400).json({ error: { code: 'INVALID_CHECKOUT_ADDRESS' } })
  const target = await ownedCheckoutCart(req)
  if (!target) return res.status(409).json({ error: { code: 'CART_UNAVAILABLE' } })
  try {
    await saveGuestAddress(req, target.cartId, email, address)
  } catch {
    return res.status(422).json({ error: { code: 'ADDRESS_UNSUPPORTED' } })
  }
  try {
    const [cart, shippingOptions] = await Promise.all([
      cartSnapshot(target.context.query, target.cartId, target.context.channelId),
      quoteCartShipping(req, target.cartId),
    ])
    return res.json({ cart, shippingOptions })
  } catch {
    return res.status(503).json({ error: { code: 'SHIPPING_QUOTE_UNAVAILABLE' } })
  }
}
