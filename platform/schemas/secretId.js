/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { canManipulateSecret, canUseSecret } from '@/lib/secret.access'

/**
 * @param {'use'|'manipulate'} accessType
 * @returns {import('joi').Schema}
 */
export default function (accessType) {
  return schema
    .string()
    .allow(null, '')
    .external(async function (value, helpers) {
      if (value) {
        value = value.trim()
      }

      if (!value) {
        if (value === undefined) {
          return
        } else {
          return null
        }
      }

      const { user } = helpers?.prefs?.context?.session || {}

      if (!user) {
        return throwNotAuthenticated()
      }

      const secret = await prisma.secret.findUniqueByIdentifier(user, value)

      if (!secret) {
        throw throwNotFound(`Secret not found`)
      }

      if (accessType === 'use' && !(await canUseSecret(user, secret))) {
        return throwNotAuthorized('You are not authorized to use this secret')
      }

      if (
        accessType === 'manipulate' &&
        !(await canManipulateSecret(user, secret))
      ) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this secret'
        )
      }

      return secret
    }, 'secretId')
}
