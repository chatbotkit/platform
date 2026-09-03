import 'dotenv/config'

import prisma from '@/prisma/client'

import { log, runScript } from '@/lib/script'

import util from 'node:util'

/**
 * Find an ability by ID.
 *
 * Usage:
 * ```bash
 * pnpm script:find-ability             # Interactive mode
 * pnpm script:find-ability --id ab123  # CLI mode
 * ```
 */
runScript({
  name: 'find-ability',
  description: 'Find an ability by ID',
  options: {
    id: {
      type: 'string',
      short: 'i',
      description: 'Ability ID',
      message: 'What is the ability id?',
      required: true,
    },
  },
  handler: async ({ id }) => {
    log(`locating ability ${id}`)

    const ability = await prisma.ability.findUnique({
      where: {
        id,
      },

      include: {
        skillset: {
          include: {
            user: true,
          },
        },
      },
    })

    if (ability) {
      log(`ability found`)
    } else {
      log(`ability not found`)

      return
    }

    log('ability', util.inspect(ability, { depth: null }))
  },
})
