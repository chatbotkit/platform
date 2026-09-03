// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withPost(
  withSession(async function (req, session) {
    const ability = await prisma.ability.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'abilityId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!ability) {
      return notFound()
    }

    if (ability.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.ability.delete({
      where: {
        id: ability.id,
      },
    })

    return ok({ id: ability.id })
  })
)

// @note this API route is not public - no documentation available
