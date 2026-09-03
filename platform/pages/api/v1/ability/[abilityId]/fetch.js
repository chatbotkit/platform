// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withSession(async function (req, session) {
    const ability = await prisma.ability.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'abilityId'),
      {
        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          skillsetId: true,

          linkedSecretId: true,

          linkedFileId: true,

          linkedBotId: true,

          linkedSpaceId: true,

          // resource specific

          instruction: true,

          // lifecycle

          state: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!ability) {
      return notFound()
    }

    if (ability.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (ability).userId)

    return ok(makeJsonSafe(ability))
  })
)

// @note this API route is not public - no documentation available
