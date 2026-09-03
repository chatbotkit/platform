import 'dotenv/config'

import prisma from '@/prisma/client'

import { deleteBot } from '@/lib/bot.delete'
import { assert } from '@/lib/debug'
import { confirm, log, runScript } from '@/lib/script'

/**
 * Delete a bot by ID.
 *
 * Usage:
 * ```bash
 * pnpm script:delete-bot                    # Interactive mode
 * pnpm script:delete-bot --botId bot123     # CLI mode (still prompts for confirmation)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'delete-bot',
  description: 'Delete a bot by ID',
  options: {
    botId: {
      type: 'string',
      short: 'b',
      description: 'Bot ID to delete',
      message: 'What is the botId?',
      required: true,
    },
  },
  handler: async ({ botId }) => {
    log(`locating bot ${botId}`)

    const bot = await prisma.bot.findUnique({
      where: {
        id: botId,
      },

      include: {
        _count: {
          include: {
            conversations: true,
          },
        },
      },
    })

    if (bot) {
      log(`bot found`, { bot })
    } else {
      log(`bot not found`)

      return
    }

    const confirmed = await confirm(
      `Do you really want to delete bot ${botId}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    assert(bot.id, 'bot id is not empty')

    await deleteBot(bot)
  },
})
