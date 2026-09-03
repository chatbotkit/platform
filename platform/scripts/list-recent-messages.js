import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'
import { findUser } from '@/lib/user.find'

/**
 * List recent messages for a user.
 *
 * Usage:
 * ```bash
 * pnpm script:list-recent-messages                           # Interactive mode
 * pnpm script:list-recent-messages -i user@example.com       # CLI mode
 * pnpm script:list-recent-messages -i conversation@[id]      # Find by conversation
 * ```
 *
 * Special syntax: Use `conversation@[conversationId]` to find users by conversation.
 */
runScript({
  name: 'list-recent-messages',
  description: 'List recent messages for a user',
  options: {
    identifier: {
      type: 'string',
      short: 'i',
      description: 'User email or special syntax (e.g., conversation@[id])',
      message: 'What is the email address for the user?',
      required: true,
    },
  },
  handler: async ({ identifier }) => {
    log(
      `You can use special syntax to location users by conversations by using conversation@[conversationId].`
    )

    const foundUser = await findUser(identifier.trim())

    if (foundUser) {
      log(`user found`)
    } else {
      log(`user not found`)

      return
    }

    // @note this does not work because we cannot select by userId

    const messages = await prisma.message.findMany({
      where: {
        userId: foundUser.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    for (const message of messages) {
      log(message)
    }
  },
})
