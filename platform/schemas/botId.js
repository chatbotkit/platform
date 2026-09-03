/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import { canManipulateBot, canUseBot } from '@/lib/bot.access'
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

      const bot = await prisma.bot.findUniqueByIdentifier(user, value)

      if (!bot) {
        throw throwNotFound(`Bot not found`)
      }

      if (accessType === 'use' && (await canUseBot(user.id, bot)) === false) {
        return throwNotAuthorized('You are not authorized to use this bot')
      }

      if (
        accessType === 'manipulate' &&
        (await canManipulateBot(user.id, bot)) === false
      ) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this bot'
        )
      }

      return bot
    }, 'botId')
}
