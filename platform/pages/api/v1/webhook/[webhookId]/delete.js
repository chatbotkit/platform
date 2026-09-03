// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (req, session) {
    const webhook = await prisma.webhook.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'webhookId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!webhook) {
      return notFound()
    }

    if (webhook.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.webhook.delete({
      where: {
        id: webhook.id,
      },
    })

    return ok({ id: webhook.id })
  })
)

// @note this endpoint is not public yet hence it does not need documentation
