import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Find expired tasks in the database.
 *
 * Usage:
 * ```bash
 * pnpm script:find-expired-tasks  # No options required
 * ```
 *
 * This script lists all tasks that have passed their expiration date.
 */
runScript({
  name: 'find-expired-tasks',
  description: 'Find expired tasks in the database',
  options: {},
  handler: async () => {
    const it = prisma.task.paginate({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },

      take: 100,
    })

    let count = 0

    for await (const item of it) {
      log(item)

      count++
    }

    if (count === 0) {
      log(`no expired tasks found`)
    } else {
      log(`found ${count} expired tasks`)
    }
  },
})
