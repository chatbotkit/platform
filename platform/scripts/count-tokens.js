import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Count tokens used by a user.
 *
 * Usage:
 * ```bash
 * pnpm script:count-tokens                        # Interactive mode
 * pnpm script:count-tokens -e user@example.com    # CLI mode
 * ```
 */
runScript({
  name: 'count-tokens',
  description: 'Count tokens used by a user',
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
      log(`user found`)
    } else {
      log(`user not found`)

      return
    }

    // @todo migrate to TypedSQL (prisma/sql) - convertible: uses a LIKE '%_TOKEN'
    // filter with no dynamic parts (rule is off for scripts/, so no disable needed)
    const {
      [0]: { total },
    } = await prisma.$queryRaw`
      SELECT
        SUM(count) AS total
      FROM
        Usage
      WHERE
        userId = ${user.id}
        AND type LIKE '%_TOKEN'
    `

    log(`user has used ${total} tokens`)

    log(`done`)
  },
})
