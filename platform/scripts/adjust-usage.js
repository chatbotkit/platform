import 'dotenv/config'

import { baseLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'

import { confirm, log, runScript } from '@/lib/script'
import { getUsage } from '@/lib/usage.get'
import { recordLanguageTokenUsage } from '@/lib/usage.record'

/**
 * Add or subtract tokens from a user's usage.
 *
 * Usage:
 * ```bash
 * pnpm script:adjust-usage                           # Interactive mode
 * pnpm script:adjust-usage -e user@example.com -u 1000  # CLI mode
 * ```
 */
runScript({
  name: 'adjust-usage',
  description: "Add or subtract tokens from a user's usage",
  options: {
    email: {
      type: 'string',
      short: 'e',
      description: 'User email address',
      message: 'What is the email address for the user?',
      required: true,
    },
    usage: {
      type: 'string',
      short: 'u',
      description: 'Number of tokens to add (can be negative)',
      message: 'How many tokens you want to add?',
      required: true,
    },
  },
  handler: async ({ email, usage: usageStr }) => {
    const usage = parseInt(usageStr)

    if (isNaN(usage)) {
      log(`invalid usage ${usageStr}`)

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

    const { tokens } = await getUsage(user.id)

    log(`user has used ${tokens} tokens`)

    const confirmed = await confirm(
      `Do you really want to add an additional ${usage} tokens for user ${email}? This will bring the total to ${
        tokens.value + usage
      } tokens.`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    // @note we use this function because it supports negative values

    await recordLanguageTokenUsage({
      user: user,
      count: usage,
      model: baseLanguageModel,
      meta: {
        comment: 'This usage record was manually added by ChatBotKit staff.',
      },
    })

    log(`done`)
  },
})
