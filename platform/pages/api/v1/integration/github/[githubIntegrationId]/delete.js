// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/github/{githubIntegrationId}/delete:
 *   post:
 *     operationId: deleteGithubIntegration
 *     summary: Delete GitHub integration
 *     tags:
 *       - GitHub Integration
 *     parameters:
 *       - in: path
 *         name: githubIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the GitHub integration
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
 *         description: The GitHub integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted GitHub integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const githubIntegration =
      await prisma.githubIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'githubIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!githubIntegration) {
      return notFound()
    }

    if (githubIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.githubIntegration.delete({
      where: {
        id: githubIntegration.id,
      },
    })

    return ok({ id: githubIntegration.id })
  })
)

/**
 * @manual GitHub Integration
 *
 * ## Deleting a GitHub Integration
 *
 * Permanently remove a GitHub integration from your ChatBotKit account. This
 * deletes the integration configuration but does not uninstall the GitHub App
 * from your account or org. After deletion, the webhook endpoint becomes
 * inactive and stops processing events.
 *
 * ```http
 * POST /api/v1/integration/github/{githubIntegrationId}/delete
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 */
