// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import descriptionSchema from '@/schemas/description'
import eventsSchema from '@/schemas/events'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import requestSchema from '@/schemas/request'

import crypto from 'crypto'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  request: requestSchema,

  events: eventsSchema,

  meta: metaSchema,
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        request,

        events,

        meta,
      } = body

      const { id } = await prisma.webhook.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

          // resource specific

          request,

          events: events ? Array.from(new Set(events)).join(',') : undefined,

          secret: `wk-${crypto.randomBytes(32).toString('hex')}`,

          // meta and others

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

// @note this endpoint is not public yet hence it does not need documentation
