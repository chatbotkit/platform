// @ts-check
import prisma from '@/prisma/client'

import { maskModelCredentials } from '@/lib/credential.mask'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/github/{githubIntegrationId}/fetch:
 *   get:
 *     operationId: fetchGithubIntegration
 *     summary: Fetch a githubIntegration
 *     tags:
 *       - GitHub Integration
 *     parameters:
 *       - in: path
 *         name: githubIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the GitHub integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The GitHub integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BotRef'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     appId:
 *                       description: The GitHub App ID
 *                       type: string
 *                     privateKey:
 *                       description: The GitHub App private key (returned as '********' if configured, null otherwise)
 *                       type: string
 *                     webhookSecret:
 *                       description: The webhook secret to paste into the GitHub App settings
 *                       type: string
 *                     contactCollection:
 *                       description: Whether to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration for the GitHub integration
 *                       type: number
 *                     allowFrom:
 *                       description: Who may talk to the agent through this integration
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const githubIntegration =
      await prisma.githubIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'githubIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            // ref

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

            blueprintId: true,

            botId: true,

            // resource specific: options

            appId: true,

            privateKey: true,

            webhookSecret: true,

            contactCollection: true,

            sessionDuration: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!githubIntegration) {
      return notFound()
    }

    if (githubIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (githubIntegration).userId)

    // @note the private key only ever travels server-to-GitHub, so it is
    // masked; the webhook secret is what the user pastes into the GitHub App
    // settings, so it stays readable - see lib/credential.policy.ts
    return ok(makeJsonSafe(maskModelCredentials('GithubIntegration', githubIntegration)))
  })
)

/**
 * @manual GitHub Integration
 *
 * ## Fetching Integration Details
 *
 * Retrieve detailed configuration for a specific GitHub integration, including
 * its GitHub App credentials.
 *
 * ```http
 * GET /api/v1/integration/github/{githubIntegrationId}/fetch
 * Authorization: Bearer YOUR_API_TOKEN
 * ```
 */
