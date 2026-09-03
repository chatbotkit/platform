import 'dotenv/config'

import { log, runScript } from '@/lib/script'
import { findUser } from '@/lib/user.find'

/**
 * Find a user by email, conversation ID, or other identifier.
 *
 * Usage:
 * ```bash
 * pnpm script:find-user                           # Interactive mode
 * pnpm script:find-user --identifier user@example.com  # CLI mode
 * pnpm script:find-user -i conversation@[id]          # Find by conversation
 * ```
 *
 * Special syntax: Use `conversation@[conversationId]` to find users by conversation.
 */
runScript({
  name: 'find-user',
  description: 'Find a user by email or conversation ID',
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

    log(foundUser)

    log(`use`, {
      access: `SKIP_USAGE_RECORDING=y RUNAS_USERID=${foundUser.id} pnpm dev`,
    })
  },
})
