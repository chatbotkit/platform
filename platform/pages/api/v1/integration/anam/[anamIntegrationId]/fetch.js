// @ts-check
import prisma from '@/prisma/client'

import { USER_AUDIENCE } from '@/lib/audience.consts'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withSession(async function (req, session) {
    const isUserAudience = session.payload.aud === USER_AUDIENCE

    const anamIntegration = await prisma.anamIntegration.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'anamIntegrationId'),
      {
        select: {
          // identifiers

          id: true,

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          botId: true,

          // resource specific

          apiKey: isUserAudience,
          personaId: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!anamIntegration) {
      return notFound()
    }

    if (anamIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (anamIntegration).userId)

    return ok(makeJsonSafe(anamIntegration))
  })
)
