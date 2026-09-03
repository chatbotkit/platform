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
 * /team/{teamId}/fetch:
 *   get:
 *     operationId: fetchTeam
 *     summary: Fetch a team
 *     tags:
 *       - Team
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           description: The ID of the team to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The team was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties: {}
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const team = await prisma.team.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'teamId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!team) {
      return notFound()
    }

    if (team.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (team).userId)

    return ok(makeJsonSafe(team))
  })
)
