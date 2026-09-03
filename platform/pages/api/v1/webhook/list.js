// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
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
      const webhooks = await prisma.webhook.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),
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

          // resource specific

          request: true,

          events: true,

          // secret: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(
          webhooks.map((webhook) => {
            if (webhook.events) {
              // @todo find more elegant way to this
              // @ts-ignore
              webhook.events = webhook.events.split(',')
            }

            return webhook
          })
        ),
      }
    })
  )
)

// @note this endpoint is not public yet hence it does not need documentation
