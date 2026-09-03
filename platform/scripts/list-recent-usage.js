import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'
import { findUser } from '@/lib/user.find'

/**
 * List recent usage for a user.
 *
 * Usage:
 * ```bash
 * pnpm script:list-recent-usage                           # Interactive mode
 * pnpm script:list-recent-usage -i user@example.com       # CLI mode
 * pnpm script:list-recent-usage -i conversation@[id]      # Find by conversation
 * ```
 *
 * Special syntax: Use `conversation@[conversationId]` to find users by conversation.
 */
runScript({
  name: 'list-recent-usage',
  description: 'List recent usage for a user',
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

    const usage = await prisma.usage.findMany({
      where: {
        userId: foundUser.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    log(usage)
  },
})
