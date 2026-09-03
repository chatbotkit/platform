// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const oAuthConnections = await prisma.oAuthConnection.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          // resource specific

          issuer: true,
          clientId: true,

          scopes: true,

          allowedDomains: true,
          requiredClaims: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(oAuthConnections),
      }
    })
  )
)

// @note this API route is not public - no documentation available
