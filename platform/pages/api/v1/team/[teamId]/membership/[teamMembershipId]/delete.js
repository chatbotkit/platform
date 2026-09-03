// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

// @note method not exposed for security reasons
// @todo decide if we should expose this method later

export default withPost(
  withUserSession(
    withSchema(bodySchema, async function (req, session) {
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

      const teamMembership = await prisma.teamMembership.findFirst({
        where: {
          id: requiredUrlParam(req, 'teamMembershipId'),
          teamId: team.id,
        },
      })

      if (!teamMembership) {
        return notFound()
      }

      await prisma.teamMembership.delete({
        where: {
          id: teamMembership.id,
        },
      })

      return ok({
        id: teamMembership.id,
      })
    })
  )
)
