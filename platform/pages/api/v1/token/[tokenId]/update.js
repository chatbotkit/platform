// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'

import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  config: schema.object().allow(null), // @todo validate the shape

  meta: metaSchema,
})

export default withPost(
  withUserSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        config,

        meta,
      } = body

      const token = await prisma.token.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'tokenId')
      )

      if (!token) {
        return notFound()
      }

      if (token.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.token.update({
        where: {
          id: token.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          // resource specific

          config,

          // meta and others

          meta: getMeta(meta, token.meta),
        },
      })

      return ok({ id: token.id })
    })
  )
)

// @note this API route is not public - no documentation available
