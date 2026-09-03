// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (req, session) {
    const anamIntegration = await prisma.anamIntegration.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'anamIntegrationId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!anamIntegration) {
      return notFound()
    }

    if (anamIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.anamIntegration.delete({
      where: {
        id: anamIntegration.id,
      },
    })

    return ok({ id: anamIntegration.id })
  })
)
