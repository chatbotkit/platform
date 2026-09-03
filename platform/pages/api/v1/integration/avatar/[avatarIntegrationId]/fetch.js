// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withSession(async function (req, session) {
    const avatarIntegration =
      await prisma.avatarIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'avatarIntegrationId'),
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

            visibility: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!avatarIntegration) {
      return notFound()
    }

    if (avatarIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (avatarIntegration).userId)

    return ok(makeJsonSafe(avatarIntegration))
  })
)
