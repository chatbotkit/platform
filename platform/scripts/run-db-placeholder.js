import 'dotenv/config'

import prisma from '@/prisma/client'
import { Schedule } from '@/prisma/types'

import { exit, log } from '@/lib/debug'

async function main() {
  // @note you can use this script to test and write anything you want
  {
    for await (const item of prisma.task.paginate({
      where: {
        schedule: Schedule.quarterhourly,

        OR: [
          {
            lastRunAt: null,
          },
          {
            lastRunAt: {
              lte: new Date(),
            },
          },
        ],
      },

      include: {
        user: true,
      },
    })) {
      log(`item`, { item })
    }
  }
}

main().catch(exit)
