import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'
import { findUser } from '@/lib/user.find'

/**
 * Rename a user's email address.
 *
 * Usage:
 * ```bash
 * pnpm script:rename-user-email                              # Interactive mode
 * pnpm script:rename-user-email -i old@example.com -n new@example.com  # CLI mode
 * ```
 *
 * Special syntax: Use `conversation@[conversationId]` to find users by conversation.
 */
runScript({
  name: 'rename-user-email',
  description: "Rename a user's email address",
  options: {
    identifier: {
      type: 'string',
      short: 'i',
      description: 'User email or special syntax (e.g., conversation@[id])',
      message: 'What is the email address for the user?',
      required: true,
    },
    newEmail: {
      type: 'string',
      short: 'n',
      description: 'New email address',
      message: 'What is the new email address for the user?',
      required: true,
    },
  },
  handler: async ({ identifier, newEmail }) => {
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

    if (foundUser.email === newEmail) {
      log(`user email is already set to`, newEmail)

      return
    }

    if (
      await prisma.user.findFirst({
        where: {
          email: newEmail,
        },
      })
    ) {
      log(`user with email ${newEmail} already exists`)

      return
    }

    log(foundUser)

    log(`updating user email to`, newEmail)

    await prisma.user.update({
      where: {
        id: foundUser.id,
      },
      data: {
        email: newEmail,
      },
    })

    const account = await prisma.account.findFirst({
      where: {
        userId: foundUser.id,
      },
    })

    if (account) {
      log(`account found`, account)

      log(`deleting account`, account)

      await prisma.account.delete({
        where: {
          id: account.id,
        },
      })
    } else {
      log(`no account found for user`)
    }
  },
})
