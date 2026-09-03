// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, _body) {
      const blueprint = await prisma.blueprint.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'blueprintId')
      )

      if (!blueprint) {
        return notFound()
      }

      if (blueprint.userId !== session.user.id) {
        return notAuthorized()
      }

      const { id } = await prisma.hubBlueprintPage.delete({
        where: {
          blueprintId: blueprint.id,
        },

        select: {
          id: true,
        },
      })

      return ok({ id: id, blueprintId: blueprint.id })
    })
  )
)
