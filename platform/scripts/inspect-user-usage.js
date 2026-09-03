import 'dotenv/config'

import prisma from '@/prisma/client'

import { getUserDisplayLimits } from '@/lib/limit.core'
import { log, print, runScript } from '@/lib/script'
import { getUsage } from '@/lib/usage.get'
import { getUserUsagePeriod } from '@/lib/usage.period'
import { revealUserPlan } from '@/lib/user.plan'

/**
 * Inspect a user's plan, live usage counters and billing period - the same
 * data the dashboard usage report renders. Read-only.
 *
 * Usage:
 * ```bash
 * pnpm script:inspect-user-usage                       # Interactive mode
 * pnpm script:inspect-user-usage -e user@example.com   # CLI mode
 * ```
 */
runScript({
  name: 'inspect-user-usage',
  description: 'Inspect a user plan, usage counters and billing period',
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

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    if (user) {
      log(`user found: ${user.id}`)
    } else {
      log(`user not found`)

      return
    }

    const { plan, effectiveUser } = await revealUserPlan(user)

    const limits = await getUserDisplayLimits(user)

    const usage = await getUsage(user.id)

    const period = await getUserUsagePeriod(user.id)

    print({
      plan,
      effectiveUser: { id: effectiveUser.id, email: effectiveUser.email },
      limits,
      usage,
      period,
    })

    log(`done`)
  },
})
