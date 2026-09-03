/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { canManipulateSkillset, canUseSkillset } from '@/lib/skillset.access'

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

      const skillset = await prisma.skillset.findUniqueByIdentifier(user, value)

      if (!skillset) {
        throw throwNotFound(`Skillset not found`)
      }

      if (
        accessType === 'use' &&
        (await canUseSkillset(user.id, skillset)) === false
      ) {
        return throwNotAuthorized('You are not authorized to use this skillset')
      }

      if (
        accessType === 'manipulate' &&
        (await canManipulateSkillset(user.id, skillset)) === false
      ) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this skillset'
        )
      }

      return skillset
    }, 'skillsetId')
}
