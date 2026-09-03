import 'dotenv/config'

import prisma from '@/prisma/client'

import { assert } from '@/lib/debug'
import { confirm, log, runScript } from '@/lib/script'
import { deleteUser } from '@/lib/user.delete'

/**
 * Delete a user by email address.
 *
 * Usage:
 * ```bash
 * pnpm script:delete-user                    # Interactive mode
 * pnpm script:delete-user --email user@example.com  # CLI mode (still prompts for confirmation)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'delete-user',
  description: 'Delete a user by email address',
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
      log(`user found`, { user })
    } else {
      log(`user not found`)

      return
    }

    const confirmed = await confirm(
      `Do you really want to delete user ${email}?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    assert(user.id, 'user id is not empty')

    await deleteUser(user.id)
  },
})
