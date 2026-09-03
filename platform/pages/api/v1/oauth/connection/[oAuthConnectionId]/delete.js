// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (req, session) {
    const oAuthConnection = await prisma.oAuthConnection.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'oAuthConnectionId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!oAuthConnection) {
      return notFound()
    }

    if (oAuthConnection.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.oAuthConnection.delete({
      where: {
        id: oAuthConnection.id,
      },
    })

    return ok({ id: oAuthConnection.id })
  })
)
