// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withUserSession(async function (req, session) {
    const token = await prisma.token.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'tokenId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          // resource specific

          config: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!token) {
      return notFound()
    }

    if (token.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (token).userId)

    return ok(makeJsonSafe(token))
  })
)

// @note this API route is not public - no documentation available
