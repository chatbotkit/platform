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

  meta: metaSchema,
})

// @note method not exposed for security reasons
// @todo decide if we should expose this method later

export default withPost(
  withUserSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { name, description, meta } = body

      const team = await prisma.team.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'teamId')
      )

      if (!team) {
        return notFound()
      }

      if (team.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.team.update({
        where: {
          id: team.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          // resource specific

          // meta and others

          meta: getMeta(meta),
        },
      })

      return ok({ id: team.id })
    })
  )
)
