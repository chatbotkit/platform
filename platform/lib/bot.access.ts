import { type Bot, BotVisibility } from '@/prisma/types'

import { captureException } from '@/lib/error'
import { getRelatedUsers } from '@/lib/user.relation'

/**
 * Checks if a user can use a bot based on ownership and visibility settings
 */
export async function canUseBot(
  userId: string,
  bot: Pick<Bot, 'userId' | 'visibility'>
): Promise<boolean> {
  // the user is the owner of the bot

  if (bot.userId === userId) {
    return true
  }

  // the bot is public

  if (bot.visibility === BotVisibility.public) {
    return true
  }

  // the bot is protected

  if (bot.visibility === BotVisibility.protected) {
    try {
      const relatedUsers = await getRelatedUsers({ id: userId })

      if (relatedUsers.some((relatedUser) => relatedUser.id === bot.userId)) {
        return true
      }
    } catch (error) {
      await captureException(error)
    }
  }

  return false
}

/**
 * Checks if a user can manipulate (modify/delete) a bot
 */
export async function canManipulateBot(
  userId: string | undefined | null,
  bot: Pick<Bot, 'userId'>
): Promise<boolean> {
  // the user is the owner of the bot

  if (bot.userId === userId) {
    return true
  }

  return false
}
