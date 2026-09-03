import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { withoutTeamAndUserRunasCookies } from '@/lib/runas'
import { withSession } from '@/lib/session.handler'

export default withGet(
  withoutTeamAndUserRunasCookies(
    withSession(async function (_req, session) {
      const teamMemberships = await prisma.teamMembership.findMany({
        where: {
          email: session.user.email,
        },

        include: {
          team: {
            select: {
              id: true,
              name: true,
              description: true,

              createdAt: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      })

      return ok({
        items: teamMemberships.map(({ team }) => ({
          id: team.id,
          name: team.name,
          description: team.description,

          createdAt: team.createdAt,
        })),
      })
    })
  )
)
