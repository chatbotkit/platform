import 'dotenv/config'

import prisma from '@/prisma/client'

import { confirm, log, runScript } from '@/lib/script'
import { getUsage } from '@/lib/usage.get'
import { recordConversationUsage, recordMessageUsage } from '@/lib/usage.record'

/**
 * Add or subtract conversations and/or messages from a user's usage.
 *
 * Usage:
 * ```bash
 * pnpm script:adjust-record-usage                                        # Interactive mode
 * pnpm script:adjust-record-usage -e user@example.com -c 10             # Adjust conversations only
 * pnpm script:adjust-record-usage -e user@example.com -m 50             # Adjust messages only
 * pnpm script:adjust-record-usage -e user@example.com -c 10 -m 50       # Adjust both
 * pnpm script:adjust-record-usage -e user@example.com -c -5 -m -20      # Subtract counts
 * ```
 */
runScript({
  name: 'adjust-record-usage',
  description:
    "Add or subtract conversations and/or messages from a user's usage",
  options: {
    email: {
      type: 'string',
      short: 'e',
      description: 'User email address',
      message: 'What is the email address for the user?',
      required: true,
    },
    conversations: {
      type: 'string',
      short: 'c',
      description: 'Number of conversations to add (can be negative)',
      message:
        'How many conversations do you want to add? (leave empty to skip)',
      required: false,
    },
    messages: {
      type: 'string',
      short: 'm',
      description: 'Number of messages to add (can be negative)',
      message: 'How many messages do you want to add? (leave empty to skip)',
      required: false,
    },
  },
  handler: async ({
    email,
    conversations: conversationsStr,
    messages: messagesStr,
  }) => {
    const conversations = conversationsStr
      ? parseInt(conversationsStr)
      : undefined
    const messages = messagesStr ? parseInt(messagesStr) : undefined

    if (conversationsStr && isNaN(conversations)) {
      log(`invalid conversations value: ${conversationsStr}`)

      return
    }

    if (messagesStr && isNaN(messages)) {
      log(`invalid messages value: ${messagesStr}`)

      return
    }

    if (conversations === undefined && messages === undefined) {
      log(
        `nothing to adjust - provide at least one of --conversations or --messages`
      )

      return
    }

    log(`locating user ${email}`)

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (user) {
      log(`user found`)
    } else {
      log(`user not found`)

      return
    }

    const { conversations: currentConversations, messages: currentMessages } =
      await getUsage(user.id)

    log(
      `user currently has ${currentConversations.value} conversations and ${currentMessages.value} messages`
    )

    const parts = []

    if (conversations !== undefined) {
      parts.push(
        `${conversations >= 0 ? '+' : ''}${conversations} conversations (${currentConversations.value} → ${currentConversations.value + conversations})`
      )
    }

    if (messages !== undefined) {
      parts.push(
        `${messages >= 0 ? '+' : ''}${messages} messages (${currentMessages.value} → ${currentMessages.value + messages})`
      )
    }

    const confirmed = await confirm(
      `Do you really want to apply ${parts.join(' and ')} for user ${email}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    // @note recordConversationUsage and recordMessageUsage support negative values
    if (conversations !== undefined) {
      await recordConversationUsage({
        user,
        count: conversations,
        meta: {
          comment: 'This usage record was manually added by ChatBotKit staff.',
        },
      })

      log(`conversations adjusted by ${conversations}`)
    }

    if (messages !== undefined) {
      await recordMessageUsage({
        user,
        count: messages,
        meta: {
          comment: 'This usage record was manually added by ChatBotKit staff.',
        },
      })

      log(`messages adjusted by ${messages}`)
    }

    log(`done`)
  },
})
