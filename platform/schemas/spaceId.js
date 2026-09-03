/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { canUseSpace } from '@/lib/space.access'

/**
 * @param {'use'} accessType
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

      const space = await prisma.space.findUniqueByIdentifier(user, value)

      if (!space) {
        throw throwNotFound(`Space not found`)
      }

      if (accessType === 'use' && !canUseSpace(user.id, space)) {
        return throwNotAuthorized('You are not authorized to use this space')
      }

      return space
    }, 'spaceId')
}
