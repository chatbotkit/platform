// @ts-check
import prisma from '@/prisma/client'

import { unblockBot } from '@/lib/bot.block'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

// @note internal route - intentionally not in swagger / public docs yet. Lifts
// a bot's block early so it can run completions again. Idempotent: unblocking a
// bot that is not blocked still succeeds. Note a usage policy whose window is
// still over threshold may re-block on the next event - clear from the policy
// to also reset the window.

export default withPost(
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

    await unblockBot(bot.id)

    return ok({ id: bot.id })
  })
)
