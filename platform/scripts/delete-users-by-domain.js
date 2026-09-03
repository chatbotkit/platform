import 'dotenv/config'

import prisma from '@/prisma/client'

import { assert } from '@/lib/debug'
import { confirm, log, runScript } from '@/lib/script'
import { deleteUser } from '@/lib/user.delete'

/**
 * Delete all users whose email belongs to a given domain.
 *
 * Each user is removed via the shared `deleteUser` helper so their resources
 * (bots, datasets, skillsets, spaces, conversations, files, blueprints, ...)
 * are cleaned up in the same way as `script:delete-user`.
 *
 * Usage:
 * ```bash
 * pnpm script:delete-users-by-domain --domain lanxiu.cc            # prompts for confirmation
 * pnpm script:delete-users-by-domain --domain lanxiu.cc --yes      # skip confirmation (batch)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'delete-users-by-domain',
  description: 'Delete all users whose email belongs to a given domain',
  options: {
    domain: {
      type: 'string',
      short: 'd',
      description: 'Email domain to match (e.g. lanxiu.cc)',
      message: 'What is the email domain to delete users for?',
      required: true,
    },
    yes: {
      type: 'boolean',
      short: 'y',
      description: 'Skip the interactive confirmation prompt',
      default: false,
    },
  },
  handler: async ({ domain, yes }) => {
    log(`locating users for domain @${domain}`)

    const users = await prisma.user.findMany({
      where: {
        email: {
          endsWith: `@${domain}`,
        },
      },
      select: {
        id: true,
        email: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (users.length === 0) {
      log(`no users found for domain @${domain}`)

      return
    }

    log(`found ${users.length} user(s)`, {
      emails: users.map((user) => user.email),
    })

    const confirmed =
      yes ||
      (await confirm(
        `Do you really want to delete all ${users.length} user(s) for @${domain}?`
      ))

    if (!confirmed) {
      log(`aborted`)

      return
    }

    let deleted = 0
    const failures = []

    for (const user of users) {
      assert(user.id, 'user id is not empty')

      log(`deleting ${user.email} (${user.id})`)

      try {
        // @note skip the deletion email for these bulk/throwaway accounts
        await deleteUser(user.id, { sendDeletionEmail: false })

        deleted += 1
      } catch (error) {
        log(`failed to delete ${user.email}`, {
          message: error instanceof Error ? error.message : String(error),
        })

        failures.push(user.email)
      }
    }

    log(`done`, {
      deleted,
      failed: failures.length,
      failures,
    })
  },
})
