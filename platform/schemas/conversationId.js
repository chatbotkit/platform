/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

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

      const conversation = await prisma.conversation.findUniqueByIdentifier(
        user,
        value
      )

      if (!conversation) {
        throw throwNotFound(`Conversation not found`)
      }

      if (accessType === 'use' && conversation.userId !== user.id) {
        return throwNotAuthorized(
          'You are not authorized to use this conversation'
        )
      }

      if (accessType === 'manipulate' && conversation.userId !== user.id) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this conversation'
        )
      }

      return conversation
    }, 'conversationId')
}
