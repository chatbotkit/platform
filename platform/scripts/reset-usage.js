import 'dotenv/config'

import { KNOWN_ACCOUNT_LIMITS, resetAccountLimits } from '@/lib/limit.core'
import { confirm, log, runScript } from '@/lib/script'
import { getUsage } from '@/lib/usage.get'
import { findUser } from '@/lib/user.find'

/**
 * Reset usage for a user.
 *
 * Usage:
 * ```bash
 * pnpm script:reset-usage                        # Interactive mode
 * pnpm script:reset-usage -e user@example.com    # CLI mode (still prompts for confirmation)
 * ```
 *
 * Warning: This will reset all usage counters for the user.
 */
runScript({
  name: 'reset-usage',
  description: 'Reset usage for a user',
  options: {
    email: {
      type: 'string',
      short: 'e',
      description: 'User email address',
      message: 'What is the email address for the user?',
      required: true,
    },
  },
  handler: async ({ email }) => {
    log(`locating user ${email}`)

    const user = await findUser(email)

    if (user) {
      log(`user found`)
    } else {
      log(`user not found`)

      return
    }

    const usage = await getUsage(user.id)

    log(`using`, { usage })

    const confirmed = await confirm(
      `Do you really want to to reset the usage for user ${email}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    await resetAccountLimits(user, KNOWN_ACCOUNT_LIMITS)

    log(`done`)
  },
})
