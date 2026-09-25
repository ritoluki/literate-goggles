import type { MedusaStoreRequest } from '@medusajs/framework/http'
import { BigNumber } from '@medusajs/framework/utils'
import {
  addShippingMethodToCartWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
  updateCartWorkflow,
} from '@medusajs/medusa/core-flows'
import { cartContext, cartSnapshot } from '../cart/cart'
import { resolveSession } from '../identity/session'

export type GuestAddress = {
  firstName: string
  lastName: string
  phone: string
  countryCode: 'vn'
  province: string
  city: string
  district?: string
  ward?: string
  address1: string
  address2?: string
  postalCode?: string
}

export function parseGuestAddress(value: unknown): GuestAddress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const allowed = ['firstName', 'lastName', 'phone', 'countryCode', 'province', 'city',
    'district', 'ward', 'address1', 'address2', 'postalCode']
  if (Object.keys(input).some((key) => !allowed.includes(key)) ||
    allowed.filter((key) => key !== 'district' && key !== 'ward' && key !== 'address2' && key !== 'postalCode')
      .some((key) => !(key in input))) return null
  const text = (key: string, min: number, max: number, optional = false): string | undefined => {
    const item = input[key]
    if (optional && item === undefined) return undefined
    if (typeof item !== 'string' || item.trim().length < min || item.trim().length > max || /[\u0000-\u001f\u007f]/.test(item)) return undefined
    return item.trim()
  }
  const firstName = text('firstName', 1, 80)
  const lastName = text('lastName', 1, 80)
  const phone = text('phone', 8, 24)
  const province = text('province', 1, 100)
  const city = text('city', 1, 100)
  const address1 = text('address1', 3, 180)
  if (!firstName || !lastName || !phone || !province || !city || !address1 ||
    input.countryCode !== 'vn' || !/^[+\d][\d\s().-]{6,22}$/.test(phone)) return null
  const optional = (key: string, max: number) => text(key, 0, max, true)
  const district = optional('district', 100)
  const ward = optional('ward', 100)
  const address2 = optional('address2', 180)
  const postalCode = optional('postalCode', 20)
  if ((input.district !== undefined && district === undefined) ||
    (input.ward !== undefined && ward === undefined) ||
    (input.address2 !== undefined && address2 === undefined) ||
    (input.postalCode !== undefined && postalCode === undefined)) return null
  return { firstName, lastName, phone, countryCode: 'vn', province, city, address1,
    ...(district ? { district } : {}), ...(ward ? { ward } : {}),
    ...(address2 ? { address2 } : {}), ...(postalCode ? { postalCode } : {}) }
}

export function parseGuestEmail(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null
}

export async function ownedCheckoutCart(req: MedusaStoreRequest) {
  const session = await resolveSession(req)
  if (!session?.cart_id) return null
  const context = await cartContext(req)
  if (!context) return null
  const { data } = await context.query.graph({
    entity: 'cart',
    fields: ['id', 'region_id', 'sales_channel_id', 'currency_code', 'completed_at',
      'items.id', 'items.quantity', 'email', 'shipping_address.*', 'shipping_methods.id'],
    filters: { id: session.cart_id },
  })
  const cart = data[0]
  if (!cart || cart.region_id !== context.regionId || cart.sales_channel_id !== context.channelId ||
    cart.currency_code !== 'vnd' || cart.completed_at || !cart.items?.length) return null
  return { cart, context, cartId: session.cart_id }
}

export async function saveGuestAddress(
  req: MedusaStoreRequest,
  cartId: string,
  email: string,
  address: GuestAddress,
) {
  const address2 = [address.ward, address.district, address.address2].filter(Boolean).join(', ')
  await updateCartWorkflow(req.scope).run({ input: {
    id: cartId,
    email,
    shipping_address: {
      first_name: address.firstName,
      last_name: address.lastName,
      phone: address.phone,
      country_code: address.countryCode,
      province: address.province,
      city: address.city,
      address_1: address.address1,
      ...(address2 ? { address_2: address2 } : {}),
      ...(address.postalCode ? { postal_code: address.postalCode } : {}),
    },
  } })
}

export async function quoteCartShipping(req: MedusaStoreRequest, cartId: string) {
  const { result } = await listShippingOptionsForCartWithPricingWorkflow(req.scope).run({
    input: { cart_id: cartId },
  })
  return result.flatMap((option) => {
    const raw = option.amount
    const amount = raw instanceof BigNumber ? raw.numeric :
      typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
    if (!option.id || !Number.isSafeInteger(amount) || amount < 0) return []
    return [{ id: option.id, name: option.name, amountVnd: amount, currencyCode: 'vnd',
      priceType: option.price_type === 'calculated' ? 'calculated' as const : 'flat' as const }]
  })
}

export async function selectCartShipping(req: MedusaStoreRequest, cartId: string, optionId: string) {
  await addShippingMethodToCartWorkflow(req.scope).run({
    input: { cart_id: cartId, options: [{ id: optionId }] },
  })
}

export { cartSnapshot }
