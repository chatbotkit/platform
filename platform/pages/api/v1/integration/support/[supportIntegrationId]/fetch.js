// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/support/{supportIntegrationId}/fetch:
 *   get:
 *     operationId: fetchSupportIntegration
 *     summary: Fetch a supportIntegration
 *     tags:
 *       - Support Integration
 *     parameters:
 *       - in: path
 *         name: supportIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Support integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Support integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - $ref: '#/components/schemas/BotRef'
 *                 - type: object
 *                   properties:
 *                     email:
 *                       description: The email to use
 *                       type: string
 *                   required:
 *                     - botId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const supportIntegration =
      await prisma.supportIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'supportIntegrationId'),
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

            botId: true,

            // resource specific

            email: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!supportIntegration) {
      return notFound()
    }

    if (supportIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (supportIntegration).userId)

    return ok(makeJsonSafe(supportIntegration))
  })
)

/**
 * @manual Support Integration
 * @index 30
 *
 * ## Fetching a Support Integration
 *
 * To retrieve detailed configuration information for a specific support
 * integration, use the fetch endpoint with the integration's unique identifier.
 * This operation returns the complete integration configuration including all
 * settings, resource associations, and metadata.
 *
 * ```http
 * GET /api/v1/integration/support/{supportIntegrationId}/fetch
 * ```
 *
 * The integration ID can be either the system-generated ID (starting with a
 * prefix) or a custom identifier you've assigned to the integration. This
 * flexibility allows you to reference integrations using whichever identifier
 * is most convenient for your application or workflow.
 *
 * ### Returned Information
 *
 * The fetch operation returns comprehensive details about the integration,
 * including its basic information (name and description), resource linking
 * details (which bot and blueprint it's associated with), the configured
 * support email address, and metadata fields that may contain custom
 * configuration or tracking information.
 *
 * This complete view of the integration configuration is essential for:
 * - Verifying integration settings before making changes
 * - Debugging issues with conversation forwarding
 * - Auditing support workflow configurations
 * - Synchronizing integration settings across systems
 */
