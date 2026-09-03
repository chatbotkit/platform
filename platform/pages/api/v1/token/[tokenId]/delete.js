// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'

export default withPost(
  withUserSession(async function (req, session) {
    const token = await prisma.token.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'tokenId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!token) {
      return notFound()
    }

    if (token.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.token.delete({
      where: {
        id: token.id,
      },
    })

    return ok({ id: token.id })
  })
)

// @note this API route is not public - no documentation available
