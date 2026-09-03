// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/skillserver/{skillserverIntegrationId}/delete:
 *   post:
 *     operationId: deleteSkillServerIntegration
 *     summary: Delete SkillServer integration
 *     tags:
 *       - SkillServer Integration
 *     parameters:
 *       - in: path
 *         name: skillserverIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the SkillServer integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The SkillServer integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted SkillServer integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const skillserverIntegration =
      await prisma.skillserverIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'skillserverIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!skillserverIntegration) {
      return notFound()
    }

    if (skillserverIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.skillserverIntegration.delete({
      where: {
        id: skillserverIntegration.id,
      },
    })

    return ok({ id: skillserverIntegration.id })
  })
)

/**
 * @manual SkillServer Integration
 *
 * ## Deleting SkillServer Integrations
 *
 * Permanently remove a SkillServer integration. External consumers immediately
 * lose access to the manual and invoke endpoints, and the static access token is
 * invalidated. The linked skillset and its abilities are not affected.
 *
 * ```http
 * POST /api/v1/integration/skillserver/{skillserverIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 */
