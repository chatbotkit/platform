// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import descriptionSchema from '@/schemas/description'
import eventsSchema from '@/schemas/events'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import requestSchema from '@/schemas/request'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  request: requestSchema,

  events: eventsSchema,

  meta: metaSchema,
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        request,

        events,

        meta,
      } = body

      const webhook = await prisma.webhook.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'webhookId')
      )

      if (!webhook) {
        return notFound()
      }

      if (webhook.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.webhook.update({
        where: {
          id: webhook.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          // resource specific

          request,

          events: events ? Array.from(new Set(events)).join(',') : undefined,

          // meta and others

          meta: getMeta(meta, webhook.meta),
        },
      })

      return ok({ id: webhook.id })
    })
  )
)

// @note this endpoint is not public yet hence it does not need documentation
