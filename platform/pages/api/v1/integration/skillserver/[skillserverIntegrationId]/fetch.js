// @ts-check
import prisma from '@/prisma/client'

import { USER_AUDIENCE } from '@/lib/audience.consts'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/skillserver/{skillserverIntegrationId}/fetch:
 *   get:
 *     operationId: fetchSkillServerIntegration
 *     summary: Fetch a skillserverIntegration
 *     tags:
 *       - SkillServer Integration
 *     parameters:
 *       - in: path
 *         name: skillserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the SkillServer integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The SkillServer integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     skillsetId:
 *                       description: The ID of the skillset
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const isUserAudience = session.payload.aud === USER_AUDIENCE

    const skillserverIntegration =
      await prisma.skillserverIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'skillserverIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

            blueprintId: true,

            skillsetId: true,

            // resource specific

            accessToken: isUserAudience, // only exposed to user audience sessions

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!skillserverIntegration) {
      return notFound()
    }

    if (skillserverIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (skillserverIntegration).userId)

    return ok(makeJsonSafe(skillserverIntegration))
  })
)

/**
 * @manual SkillServer Integration
 *
 * ## Fetching SkillServer Integration Details
 *
 * Retrieve the configuration for a SkillServer integration, including the linked
 * skillset and - for user-audience sessions - the static access token external
 * consumers use to authenticate.
 *
 * ```http
 * GET /api/v1/integration/skillserver/{skillserverIntegrationId}/fetch
 * ```
 *
 * The `accessToken` is only included for user-audience sessions. Store it
 * securely; it grants access to every ability in the linked skillset.
 */
