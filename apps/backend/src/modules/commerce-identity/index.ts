import { Module } from '@medusajs/framework/utils'
import CommerceIdentityService from './service'

export const COMMERCE_IDENTITY_MODULE = 'commerceIdentity'

export default Module(COMMERCE_IDENTITY_MODULE, {
  service: CommerceIdentityService,
})
