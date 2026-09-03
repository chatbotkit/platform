import 'dotenv/config'

import prisma from '@/prisma/client'

import { confirm, log, runScript } from '@/lib/script'
import { findUser } from '@/lib/user.find'

/**
 * Create a team for a user.
 *
 * Usage:
 * ```bash
 * pnpm script:create-team                           # Interactive mode
 * pnpm script:create-team -i user@example.com       # CLI mode
 * ```
 */
runScript({
  name: 'create-team',
  description: 'Create a team for a user',
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
      log(`user found`, { foundUser })
    } else {
      log(`user not found`)

      return
    }

    const confirmed = await confirm(
      `Should I create a team for user ${foundUser.email}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    log(`Creating team for user ${foundUser.email}...`)

    await prisma.team.create({
      data: {
        userId: foundUser.id,
        name: 'Main',
      },
    })

    log(`Team created!`)
  },
})
