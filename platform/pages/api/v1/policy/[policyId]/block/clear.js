// @ts-check
import prisma from '@/prisma/client'

import {
  getBotBlock,
  getBotsBlockedByPolicy,
  unblockBot,
} from '@/lib/bot.block'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { resetUsagePolicyCounter } from '@/lib/usage.policy'

// @note internal route - intentionally not in swagger / public docs yet. Clears
// the blocks a usage policy is holding and resets its rolling window so a
// still-elevated counter does not immediately re-trip. Bot-scoped clears only
// the targeted bot when this policy tripped it; global clears every bot it
// blocked. Returns { cleared } - the number of bots unblocked.

export default withPost(
  withSession(async function (req, session) {
    const policy = await prisma.policy.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'policyId'),
      {
        select: {
          id: true,
          userId: true,
          botId: true,
        },
      }
    )

    if (!policy) {
      return notFound()
    }

    if (policy.userId !== session.user.id) {
      return notAuthorized()
    }

    // resolve which bots this policy is currently blocking

    let botIds

    if (policy.botId) {
      const block = await getBotBlock(policy.botId)

      botIds = block?.policyId === policy.id ? [policy.botId] : []
    } else {
      botIds = await getBotsBlockedByPolicy(policy.id)
    }

    await Promise.all(botIds.map((botId) => unblockBot(botId)))

    // reset the window so a counter still over threshold does not re-block on
    // the next recorded usage event

    await resetUsagePolicyCounter(policy.id)

    return ok({ cleared: botIds.length })
  })
)
