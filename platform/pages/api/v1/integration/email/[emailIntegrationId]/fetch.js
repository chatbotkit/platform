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
 * /integration/email/{emailIntegrationId}/fetch:
 *   get:
 *     operationId: fetchEmailIntegration
 *     summary: Fetch a emailIntegration
 *     tags:
 *       - Email Integration
 *     parameters:
 *       - in: path
 *         name: emailIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Email integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Email integration was retrieved successfully
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
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration (in milliseconds)
 *                       type: number
 *                     attachments:
 *                       description: Weather the bot supports attachments
 *                       type: boolean
 *                     allowFrom:
 *                       description: Newline-separated list of email patterns allowed to send messages to this integration
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const emailIntegration =
      await prisma.emailIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'emailIntegrationId'),
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

            contactCollection: true,

            sessionDuration: true,

            attachments: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!emailIntegration) {
      return notFound()
    }

    if (emailIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (emailIntegration).userId)

    return ok(makeJsonSafe(emailIntegration))
  })
)

/**
 * @manual Email Integration
 *
 * ## Fetching Email Integration Details
 *
 * Retrieve complete configuration details for a specific Email Integration by
 * its ID. This endpoint returns all settings and resource links associated with
 * the integration, allowing you to inspect current configurations, verify settings,
 * or programmatically manage your email bot infrastructure.
 *
 * ```http
 * GET /api/v1/integration/email/{emailIntegrationId}/fetch
 * ```
 *
 * ### Response Details
 *
 * The fetch endpoint returns comprehensive information about the Email Integration:
 *
 * **Identification Details**: The response includes the unique integration ID,
 * name, and description you assigned during creation. Use these identifiers to
 * reference the integration in your applications or documentation.
 *
 * **Resource Relationships**: You'll receive the IDs of linked resources including
 * the associated bot (`botId`) and blueprint (`blueprintId` if configured). These
 * IDs allow you to query the linked resources for additional details about how
 * the integration operates.
 *
 * **Configuration Settings**: All operational parameters are included in the
 * response:
 * - `contactCollection`: Whether the integration captures contact information
 * - `sessionDuration`: The conversation context window in milliseconds
 * - `attachments`: Whether email attachments are processed
 * - `allowFrom`: Newline-separated list of email address patterns permitted to send messages.
 *   When empty, all senders are denied. Use `*` to allow all senders.
 *
 * **Metadata and Timestamps**: The response includes custom metadata stored with
 * the integration, as well as `createdAt` and `updatedAt` timestamps that track
 * when the integration was created and last modified.
 *
 * ### Use Cases for Fetching Integration Details
 *
 * **Configuration Audits**: Regularly fetch integration details to verify that
 * configurations remain correct and haven't been inadvertently modified. This is
 * particularly important in environments where multiple team members manage
 * integrations.
 *
 * **Programmatic Management**: When building administrative dashboards or
 * automation tools, use the fetch endpoint to retrieve current settings before
 * making updates. This ensures you preserve configurations you don't intend to
 * change.
 *
 * **Troubleshooting**: When investigating issues with email bot responses or
 * behavior, fetch the integration details to verify that all resource links are
 * correct and settings match your expectations.
 *
 * **Documentation and Reporting**: Generate reports about your email bot
 * infrastructure by fetching details for multiple integrations. This helps with
 * capacity planning, usage analysis, and compliance documentation.
 *
 * ### Integration with Other Operations
 *
 * The information returned by fetch is often used as input for update operations.
 * For example, you might fetch the current configuration, modify specific fields,
 * and then send the updated configuration to the update endpoint. This pattern
 * ensures you don't accidentally clear or reset fields you didn't intend to change.
 *
 * **Note**: The fetch operation is read-only and does not modify the integration
 * in any way. It's safe to call as frequently as needed for monitoring or
 * verification purposes.
 */
