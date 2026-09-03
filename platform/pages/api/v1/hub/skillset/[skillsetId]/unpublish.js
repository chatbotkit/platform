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
      const skillset = await prisma.skillset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'skillsetId')
      )

      if (!skillset) {
        return notFound()
      }

      if (skillset.userId !== session.user.id) {
        return notAuthorized()
      }

      const { id } = await prisma.hubSkillsetPage.delete({
        where: {
          skillsetId: skillset.id,
        },

        select: {
          id: true,
        },
      })

      return ok({ id: id, skillsetId: skillset.id })
    })
  )
)
