// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * -@swagger
 *
 * /team/{teamId}/membership/{teamMembershipId}/fetch:
 *   get:
 *     operationId: fetchTeamMembership
 *     summary: Fetch a team membership
 *     tags:
 *       - Team
 *       - TeamMembership
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           description: The ID of the team
 *           type: string
 *       - in: path
 *         name: teamMembershipId
 *         required: true
 *         schema:
 *           description: The ID of the membership to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The team membership was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       description: The email of the member
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
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

      select: {
        // identifiers

        id: true,

        // basic information

        name: true,
        description: true,

        // resource linking

        teamId: true,

        // resource specific

        email: true,

        // meta and others

        meta: true,

        createdAt: true,
        updatedAt: true,
      },
    })

    if (!teamMembership) {
      return notFound()
    }

    return ok(makeJsonSafe(teamMembership))
  })
)
