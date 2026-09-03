import 'dotenv/config'

import prisma from '@/prisma/client'
import { Schedule } from '@/prisma/types'

import { log, runScript } from '@/lib/script'

/**
 * Find tasks that are not scheduled to run.
 *
 * Usage:
 * ```bash
 * pnpm script:find-unscheduled-tasks  # No options required
 * ```
 *
 * This script finds tasks that have no valid schedule, no nextRunAt date,
 * and are not expired - indicating they may be stuck or misconfigured.
 */
runScript({
  name: 'find-unscheduled-tasks',
  description: 'Find tasks that are not scheduled to run',
  options: {},
  handler: async () => {
    const it = prisma.task.paginate({
      where: {
        AND: [
          // schedule is not in the list
          {
            NOT: {
              schedule: {
                in: Object.keys(Schedule),
              },
            },
          },
          // and nextRunAt is null
          {
            nextRunAt: null,
          },
          // and the task is not expired
          {
            OR: [
              {
                expiresAt: {
                  gt: new Date(),
                },
              },
              {
                expiresAt: null,
              },
            ],
          },
        ],
      },

      take: 100,
    })

    let count = 0

    for await (const item of it) {
      log(item)

      count++
    }

    if (count === 0) {
      log(`no unscheduled tasks found`)
    } else {
      log(`found ${count} unscheduled tasks`)
    }
  },
})
