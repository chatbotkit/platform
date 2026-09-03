/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import { canManipulateFile, canUseFile } from '@/lib/file.access'
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

      const file = await prisma.file.findUniqueByIdentifier(user, value)

      if (!file) {
        throw throwNotFound(`File not found`)
      }

      if (accessType === 'use' && (await canUseFile(user.id, file)) === false) {
        return throwNotAuthorized('You are not authorized to use this file')
      }

      if (
        accessType === 'manipulate' &&
        (await canManipulateFile(user.id, file)) === false
      ) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this file'
        )
      }

      return file
    }, 'fileId')
}
