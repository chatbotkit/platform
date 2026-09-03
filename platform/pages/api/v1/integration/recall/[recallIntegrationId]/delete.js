// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (req, session) {
    const recallIntegration =
      await prisma.recallIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'recallIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!recallIntegration) {
      return notFound()
    }

    if (recallIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.recallIntegration.delete({
      where: {
        id: recallIntegration.id,
      },
    })

    return ok({ id: recallIntegration.id })
  })
)
