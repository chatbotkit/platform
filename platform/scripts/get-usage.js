import 'dotenv/config'

import prisma from '@/prisma/client'

import {
  getApproximateTotalAbilities,
  getApproximateTotalRecords,
} from '@/lib/limit.estimate'
import { log, runScript } from '@/lib/script'

/**
 * Get usage information for a user.
 *
 * Usage:
 * ```bash
 * pnpm script:get-usage                        # Interactive mode
 * pnpm script:get-usage -e user@example.com    # CLI mode
 * ```
 */
runScript({
  name: 'get-usage',
  description: 'Get usage information for a user',
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

    const totalRecords = await getApproximateTotalRecords(user)

    log(`user has used ${totalRecords} records`)

    const totalAbilities = await getApproximateTotalAbilities(user)

    log(`user has used ${totalAbilities} abilities`)

    const files = await prisma.file.count({
      where: {
        userId: user.id,
      },
    })

    log(`user has uploaded ${files} files`)

    log(`done`)
  },
})
