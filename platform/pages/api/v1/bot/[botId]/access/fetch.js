// @ts-check
import prisma from '@/prisma/client'

import { getBotBlock } from '@/lib/bot.block'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

// @note internal route - intentionally not in swagger / public docs yet.
// Reports a bot's current block, if any. A bot can be blocked by a usage policy
// (or a future manual disable); the engine refuses completions while a block is
// set. Returns `{ block }` where block is null when the bot is not blocked.

export default withGet(
  withSession(async function (req, session) {
    const bot = await prisma.bot.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'botId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!bot) {
      return notFound()
    }

    if (bot.userId !== session.user.id) {
      return notAuthorized()
    }

    const block = await getBotBlock(bot.id)

    return ok({ block })
  })
)
