// @ts-check
import prisma from '@/prisma/client'

import { getBotBlock, getBotsBlockedByPolicy } from '@/lib/bot.block'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

// @note internal route - intentionally not in swagger / public docs yet. Lists
// the blocks a usage policy is currently holding. A bot-scoped policy reports
// the targeted bot only when this policy tripped its block; a global policy
// scans for every bot it has blocked. Returns { scope, botId, block,
// blockedBotIds }.

export default withGet(
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

    // bot-scoped policy: attribute the targeted bot's block only when this
    // policy tripped it, so unrelated blocks on the same bot are not reported
    // here

    if (policy.botId) {
      const block = await getBotBlock(policy.botId)

      const owned = block?.policyId === policy.id ? block : null

      return ok({
        scope: 'bot',
        botId: policy.botId,
        block: owned,
        blockedBotIds: owned ? [policy.botId] : [],
      })
    }

    // global policy: scan for every bot this policy currently blocks

    const blockedBotIds = await getBotsBlockedByPolicy(policy.id)

    return ok({ scope: 'global', botId: null, block: null, blockedBotIds })
  })
)
