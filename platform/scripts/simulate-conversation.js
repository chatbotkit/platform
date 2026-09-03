// @ts-check
import 'dotenv/config'

import prisma from '@/prisma/client'

import { getSortedMessages } from '@/lib/message'
import { log, print, runScript } from '@/lib/script'

/**
 * Simulate continuing a conversation without persisting any new messages.
 *
 * Usage:
 * ```bash
 * pnpm script:simulate-conversation                            # Interactive mode
 * pnpm script:simulate-conversation --conversationId conv123   # CLI mode
 * OUTPUT=json pnpm script:simulate-conversation -c conv123     # JSON output
 * ```
 */
runScript({
  name: 'simulate-conversation',
  description:
    'Continue a conversation from the current stored history without persisting new messages',
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
    const { getStatelessConversationEngine } = await import(
      '@/lib/conversation.engine'
    )

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },

      select: {
        id: true,
        userId: true,

        botId: true,
        contactId: true,

        backstory: true,
        model: true,

        datasetId: true,
        skillsetId: true,

        privacy: true,
        moderation: true,
      },
    })

    if (!conversation) {
      log(`conversation not found ${conversationId}`)

      return
    }

    // @note use findMyriad here like the conversation message listing path to
    // avoid loading large text payloads into a single sort buffer.
    const messages = getSortedMessages(
      await prisma.message.findMyriad({
        where: {
          conversationId: conversation.id,
        },

        select: {
          id: true,

          type: true,
          text: true,

          meta: true,

          createdAt: true,
        },
      })
    )

    const engine = await getStatelessConversationEngine({
      botId: conversation.botId ?? undefined,

      backstory: conversation.backstory ?? undefined,
      model: conversation.model ?? undefined,

      datasetId: conversation.datasetId ?? undefined,
      skillsetId: conversation.skillsetId ?? undefined,

      privacy: conversation.privacy ?? undefined,
      moderation: conversation.moderation ?? undefined,

      contact: conversation.contactId
        ? { id: conversation.contactId }
        : undefined,

      messages,

      options: {
        userId: conversation.userId,
      },
    })

    try {
      const result = await engine.complete()

      if (process.env.OUTPUT === 'json') {
        print(
          JSON.stringify(
            {
              conversationId: conversation.id,
              reason: result.reason,
              messages: result.messages,
            },
            null,
            2
          )
        )

        return
      }

      log(`conversation ID: ${conversation.id}`)
      log(`reason: ${result.reason}`)

      if (!result.messages.length) {
        log('no new messages emitted')

        return
      }

      print(
        result.messages
          .map(({ type, text, meta }) => {
            if (text) {
              return `${type}: ${text}`
            }

            return `${type}: ${JSON.stringify(meta)}`
          })
          .join('\n\n')
      )
    } finally {
      await engine.dispose()
    }
  },
})
