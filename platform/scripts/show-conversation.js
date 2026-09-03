// @ts-check
import 'dotenv/config'

import prisma from '@/prisma/client'

import { getSortedMessages } from '@/lib/message'
import { log, runScript } from '@/lib/script'

/**
 * Show a conversation and its messages.
 *
 * Usage:
 * ```bash
 * pnpm script:show-conversation                           # Interactive mode
 * pnpm script:show-conversation --conversationId conv123  # CLI mode
 * OUTPUT=json pnpm script:show-conversation -c conv123    # JSON output
 * ```
 */
runScript({
  name: 'show-conversation',
  description: 'Show a conversation and its messages',
  options: {
    conversationId: {
      type: 'string',
      short: 'c',
      description: 'Conversation ID',
      message: 'What is the ID of the conversation?',
      required: true,
    },
  },
  handler: async ({ conversationId }) => {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },

      select: {
        bot: {
          select: {
            id: true,

            backstory: true,

            model: true,
          },
        },

        backstory: true,

        model: true,

        messages: {
          select: {
            id: true,

            type: true,
            text: true,

            meta: true,

            createdAt: true,
          },
        },
      },
    })

    if (!conversation) {
      log(`conversation not found ${conversationId}`)

      return
    }

    if (conversation.bot?.id) {
      log(`bot ID: ${conversation.bot.id}`)
    }

    if (conversation.bot?.backstory) {
      log(`bot backstory: ${conversation.bot.backstory}`)
    }

    if (conversation.bot?.model) {
      log(`bot model: ${conversation.bot.model}`)
    }

    if (conversation.backstory) {
      log(`backstory: ${conversation.backstory}`)
    }

    if (conversation.model) {
      log(`model: ${conversation.model}`)
    }

    if (process.env.OUTPUT === 'json') {
      log(JSON.stringify(getSortedMessages(conversation.messages), null, 2))
    } else {
      log(
        getSortedMessages(conversation.messages)
          .map(({ type, text }) => `${type}: ${text}`)
          .join('\n\n')
      )
    }
  },
})
