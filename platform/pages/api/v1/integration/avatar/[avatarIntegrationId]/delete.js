// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (req, session) {
    const avatarIntegration = await prisma.avatarIntegration.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'avatarIntegrationId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!avatarIntegration) {
      return notFound()
    }

    if (avatarIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.avatarIntegration.delete({
      where: {
        id: avatarIntegration.id,
      },
    })

    return ok({ id: avatarIntegration.id })
  })
)
