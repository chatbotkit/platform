import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Find a session by ID.
 *
 * Usage:
 * ```bash
 * pnpm script:find-session              # Interactive mode
 * pnpm script:find-session --session s123  # CLI mode
 * ```
 */
runScript({
  name: 'find-session',
  description: 'Find a session by ID',
  options: {
    session: {
      type: 'string',
      short: 's',
      description: 'Session ID',
      message: 'What is the session ID?',
      required: true,
    },
  },
  handler: async ({ session }) => {
    const foundSession = await prisma.session.findUnique({
      where: {
        id: session,
      },
    })

    if (foundSession) {
      log(`session found`)
    } else {
      log(`session not found`)

      return
    }

    log(foundSession)
  },
})
