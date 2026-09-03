/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import { canManipulateBlueprint, canUseBlueprint } from '@/lib/blueprint.access'
import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

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

      const blueprint = await prisma.blueprint.findUniqueByIdentifier(
        user,
        value
      )

      if (!blueprint) {
        throw throwNotFound(`Blueprint not found`)
      }

      if (accessType === 'use' && !canUseBlueprint(user, blueprint)) {
        return throwNotAuthorized(
          'You are not authorized to use this blueprint'
        )
      }

      if (
        accessType === 'manipulate' &&
        !canManipulateBlueprint(user, blueprint)
      ) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this blueprint'
        )
      }

      return blueprint
    }, 'blueprintId')
}
