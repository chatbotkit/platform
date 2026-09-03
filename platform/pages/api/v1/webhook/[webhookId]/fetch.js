// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

export default withGet(
  withSession(async function (req, session) {
    const webhook = await prisma.webhook.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'webhookId'),
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

          request: true,

          events: true,

          // secret: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!webhook) {
      return notFound()
    }

    if (webhook.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (webhook).userId)

    if (webhook.events) {
      // @todo find more elegant way to this
      // @ts-ignore
      webhook.events = webhook.events.split(',')
    }

    return ok(makeJsonSafe(webhook))
  })
)

// @note this endpoint is not public yet hence it does not need documentation
